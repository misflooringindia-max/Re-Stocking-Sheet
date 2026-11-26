import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  aggregateSalesCsv,
  buildSalesConsumptionIndex,
  computeRangeSalesFromBuckets,
  type DailySalesBucket,
  type SalesConsumptionIndexPayload,
  type SalesSummaryPayload,
} from './src/utils/salesAggregation.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const DEFAULT_SALES_CSV_URL =
  'https://docs.google.com/spreadsheets/d/1Xcyd7GOPosV2caGm-fj6ey3KlnvxkhmjcWkywsQVFeg/export?format=csv&gid=2130481940';

const salesCache = new Map<string, { timestamp: number; data: SalesSummaryPayload }>();
const dailySalesCache = new Map<string, { timestamp: number; days: DailySalesBucket[] }>();
const consumptionIndexCache = new Map<
  string,
  { timestamp: number; data: SalesConsumptionIndexPayload }
>();
const SALES_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function normalizeSalesSheetCsvUrl(rawInput: string): URL {
  const raw = rawInput.trim();
  if (!raw) {
    const err: any = new Error('Missing sales Google Sheet URL.');
    err.statusCode = 400;
    throw err;
  }

  // Handle raw spreadsheet IDs pasted directly
  if (/^[a-zA-Z0-9-_]{25,}$/.test(raw)) {
    if (raw.startsWith('2PACX-')) {
      return new URL(`https://docs.google.com/spreadsheets/d/e/${raw}/pub?output=csv`);
    }
    return new URL(`https://docs.google.com/spreadsheets/d/${raw}/export?format=csv`);
  }

  const parsed = new URL(raw);
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== 'docs.google.com' ||
    !parsed.pathname.startsWith('/spreadsheets/')
  ) {
    const err: any = new Error('Only https://docs.google.com/spreadsheets/ links are allowed.');
    err.statusCode = 403;
    throw err;
  }

  if (parsed.pathname.includes('/spreadsheets/d/e/')) {
    const pubMatch = parsed.pathname.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/);
    if (pubMatch && pubMatch[1]) {
      const params = new URLSearchParams();
      const gid = parsed.searchParams.get('gid');
      const single = parsed.searchParams.get('single');
      if (gid) params.set('gid', gid);
      if (single) params.set('single', single);
      params.set('output', 'csv');
      return new URL(`https://docs.google.com/spreadsheets/d/e/${pubMatch[1]}/pub?${params.toString()}`);
    }
  } else {
    const idMatch = parsed.pathname.match(/\/spreadsheets(?:\/u\/\d+)?\/d\/([a-zA-Z0-9-_]+)/);
    if (idMatch && idMatch[1]) {
      let gid = parsed.searchParams.get('gid');
      if (!gid && parsed.hash) {
        const hashMatch = parsed.hash.match(/gid=([0-9]+)/);
        if (hashMatch) gid = hashMatch[1];
      }
      const exportUrl = gid
        ? `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`
        : `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv`;
      return new URL(exportUrl);
    }
  }

  return parsed;
}

async function fetchGoogleCsvWithRetry(csvUrl: string): Promise<string> {
  const attempt = async () => {
    const response = await fetch(csvUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'StockSync-Inventory-Dashboard/1.0',
        Accept: 'text/csv,text/plain,*/*',
      },
    });

    if (!response.ok) {
      const err: any = new Error(
        response.status === 404
          ? 'Google Sheet or tab (gid) not found (HTTP 404). Please verify the sheet URL and gid.'
          : `Google Sheets returned HTTP ${response.status}`
      );
      err.statusCode = response.status;
      throw err;
    }

    const text = await response.text();
    if (
      text.trimStart().startsWith('<!DOCTYPE html') ||
      text.trimStart().startsWith('<html') ||
      text.includes('Sign in - Google Accounts')
    ) {
      const err: any = new Error(
        'This Google Sheet is not publicly accessible. Please publish to web as CSV or allow "Anyone with the link can view".'
      );
      err.statusCode = 403;
      throw err;
    }
    return text;
  };

  try {
    return await attempt();
  } catch (err: any) {
    const code = err?.statusCode;
    // Do not retry deterministic 400/403/404 responses from Google
    if (code && code >= 400 && code < 500 && code !== 429) {
      throw err;
    }
    await new Promise((r) => setTimeout(r, 1000));
    return attempt();
  }
}

async function startServer() {
  const app = express();

  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  });

  // Direct Google Sheet CSV proxy to bypass browser 307 redirect CORS restrictions
  // Strictly allowlisted to https://docs.google.com/spreadsheets/* only
  app.get('/api/sheet-csv', async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!rawUrl) {
      res.status(400).json({ error: 'Missing url parameter' });
      return;
    }

    let parsed: URL;
    try {
      parsed = normalizeSalesSheetCsvUrl(rawUrl);
    } catch (err: any) {
      res.status(err?.statusCode || 400).json({ error: err?.message || 'Invalid URL format' });
      return;
    }

    try {
      const text = await fetchGoogleCsvWithRetry(parsed.toString());
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(text);
    } catch (err: any) {
      res.status(err?.statusCode || 502).json({
        error: err?.message || 'Failed to fetch spreadsheet from Google.',
      });
    }
  });

  const inFlightSalesLoads = new Map<
    string,
    Promise<{
      summary: SalesSummaryPayload;
      index: SalesConsumptionIndexPayload;
      dailyBuckets: DailySalesBucket[];
    }>
  >();

  async function fetchAndBuildSales(cacheKey: string): Promise<{
    summary: SalesSummaryPayload;
    index: SalesConsumptionIndexPayload;
    dailyBuckets: DailySalesBucket[];
  }> {
    const existing = inFlightSalesLoads.get(cacheKey);
    if (existing) return existing;

    const promise = (async () => {
      const text = await fetchGoogleCsvWithRetry(cacheKey);
      const { summary, dailyBuckets } = aggregateSalesCsv(text);
      const index = buildSalesConsumptionIndex(text);
      const now = Date.now();
      salesCache.set(cacheKey, { timestamp: now, data: summary });
      dailySalesCache.set(cacheKey, { timestamp: now, days: dailyBuckets });
      consumptionIndexCache.set(cacheKey, { timestamp: now, data: index });
      return { summary, index, dailyBuckets };
    })().finally(() => {
      inFlightSalesLoads.delete(cacheKey);
    });

    inFlightSalesLoads.set(cacheKey, promise);
    return promise;
  }

  // Aggregated Sales Summary API (aggregates 290k+ sales rows per Simplified item on server)
  app.get('/api/sales-summary', async (req: Request, res: Response) => {
    const rawUrl =
      typeof req.query.url === 'string' && req.query.url.trim()
        ? req.query.url.trim()
        : DEFAULT_SALES_CSV_URL;
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';

    let parsed: URL;
    try {
      parsed = normalizeSalesSheetCsvUrl(rawUrl);
    } catch (err: any) {
      res.status(err?.statusCode || 400).json({ error: err?.message || 'Invalid sales sheet URL format' });
      return;
    }

    const cacheKey = parsed.toString();
    const cached = salesCache.get(cacheKey);
    if (!forceRefresh && cached) {
      const isFresh = Date.now() - cached.timestamp < SALES_CACHE_TTL_MS;
      if (!isFresh) {
        fetchAndBuildSales(cacheKey).catch(() => {});
      }
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(cached.data);
      return;
    }

    try {
      const { summary } = await fetchAndBuildSales(cacheKey);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(summary);
    } catch (err: any) {
      res.status(err?.statusCode || 502).json({
        error: err?.message || 'Failed to fetch and aggregate sales CSV from Google.',
      });
    }
  });

  // Strict Month/Year/Simplified/Qty Consumption Index API
  app.get('/api/sales-consumption-index', async (req: Request, res: Response) => {
    const rawUrl =
      typeof req.query.url === 'string' && req.query.url.trim()
        ? req.query.url.trim()
        : DEFAULT_SALES_CSV_URL;
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';

    let parsed: URL;
    try {
      parsed = normalizeSalesSheetCsvUrl(rawUrl);
    } catch (err: any) {
      res.status(err?.statusCode || 400).json({ error: err?.message || 'Invalid sales sheet URL format' });
      return;
    }

    const cacheKey = parsed.toString();
    const cached = consumptionIndexCache.get(cacheKey);
    if (!forceRefresh && cached) {
      const isFresh = Date.now() - cached.timestamp < SALES_CACHE_TTL_MS;
      if (!isFresh) {
        fetchAndBuildSales(cacheKey).catch(() => {});
      }
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(cached.data);
      return;
    }

    try {
      const { index } = await fetchAndBuildSales(cacheKey);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(index);
    } catch (err: any) {
      res.status(err?.statusCode || 502).json({
        error: err?.message || 'Failed to fetch sales CSV for consumption calculation.',
      });
    }
  });

  // Custom From-To Date Range Sales Query API (filters cached daily buckets in milliseconds)
  app.get('/api/sales-range', async (req: Request, res: Response) => {
    const rawUrl =
      typeof req.query.url === 'string' && req.query.url.trim()
        ? req.query.url.trim()
        : DEFAULT_SALES_CSV_URL;
    const from = typeof req.query.from === 'string' ? req.query.from.trim() : '';
    const to = typeof req.query.to === 'string' ? req.query.to.trim() : '';
    const isoRe = /^\d{4}-\d{2}-\d{2}$/;

    if (!isoRe.test(from) || !isoRe.test(to)) {
      res.status(400).json({ error: 'Invalid from/to date format. Use YYYY-MM-DD.' });
      return;
    }
    if (from > to) {
      res.status(400).json({ error: 'Start date must be on or before end date.' });
      return;
    }

    let parsed: URL;
    try {
      parsed = normalizeSalesSheetCsvUrl(rawUrl);
    } catch (err: any) {
      res.status(err?.statusCode || 400).json({ error: err?.message || 'Invalid sales sheet URL format' });
      return;
    }

    const cacheKey = parsed.toString();
    try {
      let days = dailySalesCache.get(cacheKey)?.days;
      if (!days) {
        const loaded = await fetchAndBuildSales(cacheKey);
        days = loaded.dailyBuckets;
      } else {
        const cachedEntry = dailySalesCache.get(cacheKey);
        if (cachedEntry && Date.now() - cachedEntry.timestamp >= SALES_CACHE_TTL_MS) {
          fetchAndBuildSales(cacheKey).catch(() => {});
        }
      }

      const payload = computeRangeSalesFromBuckets(days, from, to);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(payload);
    } catch (err: any) {
      res.status(err?.statusCode || 502).json({
        error: err?.message || 'Failed to compute sales for selected date range.',
      });
    }
  });

  const distPath = path.resolve(__dirname, 'dist');
  const isProdMode =
    process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'start';

  if (isProdMode && fs.existsSync(path.join(distPath, 'index.html'))) {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    // Pre-warm default sales sheet cache immediately on server startup
    fetchAndBuildSales(DEFAULT_SALES_CSV_URL)
      .then(({ summary }) => {
        console.log(
          `Pre-warmed sales cache: ${summary.totalRows.toLocaleString()} rows across ${summary.uniqueSimplified.toLocaleString()} Simplified SKUs`
        );
      })
      .catch((err) => {
        console.warn('Initial sales cache pre-warm failed:', err?.message || err);
      });
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
