import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const DEFAULT_SALES_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQDxz7MDyPeEDk6TFYU-vAeBPQT3rrZ6G3wXaL_4BQfKMphIBcdm2sbZS2DMYPD5pRbpENut1mI0ol3/pub?output=csv';

const MONTH_MAP: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

interface SalesAggregationRecord {
  name: string;
  total: number;
  m1: number;
  m3: number;
  m6: number;
  m12: number;
  orders: number;
  monthly: Record<string, number>;
  portals: Record<string, number>;
}

interface SalesSummaryPayload {
  bySimplified: Record<string, SalesAggregationRecord>;
  totalRows: number;
  totalUnits: number;
  uniqueSimplified: number;
  minDate: string;
  maxDate: string;
  availableMonths: string[];
  syncedAt: string;
}

const salesCache = new Map<string, { timestamp: number; data: SalesSummaryPayload }>();
const SALES_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const STRICT_MONTH_MAP: Record<string, number> = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
};

interface SalesConsumptionIndexPayload {
  bySimplifiedMonths: Record<string, Record<number, number>>;
  availableDateVals: number[];
  minDateVal: number;
  maxDateVal: number;
  totalRows: number;
  qualifiedRows: number;
  uniqueSimplified: number;
  syncedAt: string;
}

const consumptionIndexCache = new Map<
  string,
  { timestamp: number; data: SalesConsumptionIndexPayload }
>();

function buildSalesConsumptionIndex(csvText: string): SalesConsumptionIndexPayload {
  const lines = csvText.split(/\r?\n/);
  if (lines.length === 0) {
    throw new Error('Sales CSV is empty.');
  }

  // Exact 0-based indices per specification:
  // Index 3 (Col D): Qty
  // Index 5 (Col F): Month (January..December)
  // Index 6 (Col G): Year (integer)
  // Index 7 (Col H): Simplified (trimmed, case-sensitive)
  // Do NOT parse Col A (Date), do NOT dedup Order Id, do NOT read ReturnImport.
  const bySimplifiedMonths: Record<string, Record<number, number>> = Object.create(null);
  const dateValSet = new Set<number>();
  let totalRows = 0;
  let qualifiedRows = 0;
  let minDateVal = Infinity;
  let maxDateVal = -Infinity;

  // Skip header row (row 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    totalRows++;

    const cols = line.includes('"') ? parseCsvLine(line) : line.split(',');

    const monthName = (cols[5] ?? '').toString().trim();
    const monthNum = Object.prototype.hasOwnProperty.call(STRICT_MONTH_MAP, monthName)
      ? STRICT_MONTH_MAP[monthName]
      : undefined;
    if (monthNum === undefined) continue;

    const yearStr = (cols[6] ?? '').toString().trim();
    const yearNum = parseInt(yearStr, 10);
    if (isNaN(yearNum)) continue;

    const key = (cols[7] ?? '').toString().trim();
    if (!key) continue;

    let qty = parseFloat((cols[3] ?? '').toString().trim());
    if (isNaN(qty)) qty = 0;

    const dateVal = yearNum * 12 + monthNum;
    dateValSet.add(dateVal);
    if (dateVal < minDateVal) minDateVal = dateVal;
    if (dateVal > maxDateVal) maxDateVal = dateVal;

    let bucket = bySimplifiedMonths[key];
    if (!bucket) {
      bucket = Object.create(null);
      bySimplifiedMonths[key] = bucket;
    }
    bucket[dateVal] = (bucket[dateVal] || 0) + qty;
    qualifiedRows++;
  }

  const availableDateVals = Array.from(dateValSet).sort((a, b) => a - b);
  if (availableDateVals.length === 0) {
    minDateVal = 0;
    maxDateVal = 0;
  }

  return {
    bySimplifiedMonths,
    availableDateVals,
    minDateVal,
    maxDateVal,
    totalRows,
    qualifiedRows,
    uniqueSimplified: Object.keys(bySimplifiedMonths).length,
    syncedAt: new Date().toISOString(),
  };
}

function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cols.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  cols.push(cur);
  return cols;
}

function parseSalesDateMs(rawDate: string, rawMonth: string, rawYear: string): number | null {
  const dTrim = rawDate.trim();

  // 1. Excel serial date (e.g. 45955)
  if (/^\d{5}(\.\d+)?$/.test(dTrim)) {
    const serial = parseFloat(dTrim);
    if (serial > 30000 && serial < 70000) {
      return Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000;
    }
  }

  // 2. Fast-path "DD Month YYYY" (e.g. "16 April 2026")
  const dmyMatch = dTrim.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const mon = MONTH_MAP[dmyMatch[2].toLowerCase()];
    const year = parseInt(dmyMatch[3], 10);
    if (mon !== undefined && year >= 2000 && year <= 2100 && day >= 1 && day <= 31) {
      return Date.UTC(year, mon, day);
    }
  }

  // 3. ISO YYYY-MM-DD
  const isoMatch = dTrim.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const mon = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    if (year >= 2000 && year <= 2100 && mon >= 0 && mon <= 11) {
      return Date.UTC(year, mon, day);
    }
  }

  // 4. Generic Date fallback
  if (dTrim) {
    const parsed = Date.parse(dTrim);
    if (!Number.isNaN(parsed)) {
      const y = new Date(parsed).getUTCFullYear();
      if (y >= 2000 && y <= 2100) return parsed;
    }
  }

  // 5. Fallback to Month + Year columns
  const mon = MONTH_MAP[rawMonth.trim().toLowerCase()];
  const yr = parseInt(rawYear.trim(), 10);
  if (mon !== undefined && yr >= 2000 && yr <= 2100) {
    return Date.UTC(yr, mon, 15);
  }

  return null;
}

function aggregateSalesCsv(csvText: string): SalesSummaryPayload {
  const lines = csvText.split(/\r?\n/);
  if (lines.length === 0) {
    throw new Error('Sales CSV is empty.');
  }

  // Locate header row
  let headerIdx = 0;
  let headerCols: string[] = [];
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCsvLine(lines[i]).map((c) => c.trim().toLowerCase());
    if (cols.some((c) => c.includes('simplified') || c.includes('qty') || c.includes('date'))) {
      headerIdx = i;
      headerCols = cols;
      break;
    }
  }

  const dateIdx = headerCols.findIndex((h) => h === 'date' || h.includes('date'));
  const qtyIdx = headerCols.findIndex((h) => h === 'qty' || h.includes('quantity'));
  const portalIdx = headerCols.findIndex((h) => h === 'portal' || h.includes('portal'));
  const monthIdx = headerCols.findIndex((h) => h === 'month');
  const yearIdx = headerCols.findIndex((h) => h === 'year');
  const simplifiedIdx = headerCols.findIndex((h) => h === 'simplified' || h.includes('simplified'));

  const effDateIdx = dateIdx >= 0 ? dateIdx : 0;
  const effQtyIdx = qtyIdx >= 0 ? qtyIdx : 3;
  const effPortalIdx = portalIdx >= 0 ? portalIdx : 4;
  const effMonthIdx = monthIdx >= 0 ? monthIdx : 5;
  const effYearIdx = yearIdx >= 0 ? yearIdx : 6;
  const effSimplifiedIdx = simplifiedIdx >= 0 ? simplifiedIdx : 7;

  // Compact row storage for two-pass cutoff calculation (supports exact windows relative to maxDate)
  interface CompactSaleRow {
    key: string;
    displayName: string;
    qty: number;
    dateMs: number | null;
    ym: string;
    portal: string;
  }

  const compactRows: CompactSaleRow[] = [];
  let minDateMs = Infinity;
  let maxDateMs = -Infinity;
  let totalUnits = 0;
  const monthSet = new Set<string>();

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;

    // Fast path when no quotes exist in the line
    const cols = line.includes('"') ? parseCsvLine(line) : line.split(',');

    const rawSimplified = (cols[effSimplifiedIdx] || '').trim();
    if (!rawSimplified) continue;

    const qty = Math.max(0, parseInt((cols[effQtyIdx] || '0').trim(), 10) || 0);
    if (qty === 0) continue;

    const rawDate = cols[effDateIdx] || '';
    const rawMonth = cols[effMonthIdx] || '';
    const rawYear = cols[effYearIdx] || '';
    const dateMs = parseSalesDateMs(rawDate, rawMonth, rawYear);

    let ym = '';
    if (dateMs !== null) {
      if (dateMs < minDateMs) minDateMs = dateMs;
      if (dateMs > maxDateMs) maxDateMs = dateMs;
      const d = new Date(dateMs);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      ym = `${y}-${m}`;
      monthSet.add(ym);
    } else {
      const mNum = MONTH_MAP[rawMonth.trim().toLowerCase()];
      const yr = parseInt(rawYear.trim(), 10);
      if (mNum !== undefined && yr >= 2000 && yr <= 2100) {
        ym = `${yr}-${String(mNum + 1).padStart(2, '0')}`;
        monthSet.add(ym);
      }
    }

    const portal = (cols[effPortalIdx] || '').trim() || 'Other';
    totalUnits += qty;

    compactRows.push({
      key: rawSimplified.toLowerCase(),
      displayName: rawSimplified,
      qty,
      dateMs,
      ym,
      portal,
    });
  }

  if (maxDateMs === -Infinity) {
    maxDateMs = Date.now();
    minDateMs = maxDateMs;
  }

  const DAY_MS = 86400000;
  const cutoff1m = maxDateMs - 30 * DAY_MS;
  const cutoff3m = maxDateMs - 90 * DAY_MS;
  const cutoff6m = maxDateMs - 180 * DAY_MS;
  const cutoff12m = maxDateMs - 365 * DAY_MS;

  const bySimplified: Record<string, SalesAggregationRecord> = {};

  for (let i = 0; i < compactRows.length; i++) {
    const r = compactRows[i];
    let rec = bySimplified[r.key];
    if (!rec) {
      rec = {
        name: r.displayName,
        total: 0,
        m1: 0,
        m3: 0,
        m6: 0,
        m12: 0,
        orders: 0,
        monthly: {},
        portals: {},
      };
      bySimplified[r.key] = rec;
    }

    rec.total += r.qty;
    rec.orders += 1;

    if (r.dateMs !== null) {
      if (r.dateMs >= cutoff1m) rec.m1 += r.qty;
      if (r.dateMs >= cutoff3m) rec.m3 += r.qty;
      if (r.dateMs >= cutoff6m) rec.m6 += r.qty;
      if (r.dateMs >= cutoff12m) rec.m12 += r.qty;
    }

    if (r.ym) {
      rec.monthly[r.ym] = (rec.monthly[r.ym] || 0) + r.qty;
    }
    rec.portals[r.portal] = (rec.portals[r.portal] || 0) + r.qty;
  }

  const availableMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a));

  return {
    bySimplified,
    totalRows: compactRows.length,
    totalUnits,
    uniqueSimplified: Object.keys(bySimplified).length,
    minDate: new Date(minDateMs).toISOString().slice(0, 10),
    maxDate: new Date(maxDateMs).toISOString().slice(0, 10),
    availableMonths,
    syncedAt: new Date().toISOString(),
  };
}

async function startServer() {
  const app = express();

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
      parsed = new URL(rawUrl);
    } catch {
      res.status(400).json({ error: 'Invalid URL format' });
      return;
    }

    if (
      parsed.protocol !== 'https:' ||
      parsed.hostname !== 'docs.google.com' ||
      !parsed.pathname.startsWith('/spreadsheets/')
    ) {
      res.status(403).json({
        error: 'Only https://docs.google.com/spreadsheets/ links are allowed.',
      });
      return;
    }

    try {
      const response = await fetch(parsed.toString(), {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'StockSync-Inventory-Dashboard/1.0',
          Accept: 'text/csv,text/plain,*/*',
        },
      });

      if (!response.ok) {
        res.status(response.status).json({
          error: `Google Sheets returned HTTP ${response.status}`,
        });
        return;
      }

      const text = await response.text();
      if (
        text.trimStart().startsWith('<!DOCTYPE html') ||
        text.trimStart().startsWith('<html') ||
        text.includes('Sign in - Google Accounts')
      ) {
        res.status(403).json({
          error:
            'This Google Sheet is not publicly accessible. Please use File → Share → Publish to web (CSV) or set sharing to "Anyone with the link can view".',
        });
        return;
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(text);
    } catch (err: any) {
      res.status(502).json({
        error: err?.message || 'Failed to fetch spreadsheet from Google.',
      });
    }
  });

  // Aggregated Sales Summary API (aggregates 290k+ sales rows per Simplified item on server)
  app.get('/api/sales-summary', async (req: Request, res: Response) => {
    const rawUrl =
      typeof req.query.url === 'string' && req.query.url.trim()
        ? req.query.url.trim()
        : DEFAULT_SALES_CSV_URL;
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      res.status(400).json({ error: 'Invalid sales sheet URL format' });
      return;
    }

    if (
      parsed.protocol !== 'https:' ||
      parsed.hostname !== 'docs.google.com' ||
      !parsed.pathname.startsWith('/spreadsheets/')
    ) {
      res.status(403).json({
        error: 'Only https://docs.google.com/spreadsheets/ links are allowed.',
      });
      return;
    }

    const cacheKey = parsed.toString();
    const cached = salesCache.get(cacheKey);
    if (!forceRefresh && cached && Date.now() - cached.timestamp < SALES_CACHE_TTL_MS) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(cached.data);
      return;
    }

    try {
      const response = await fetch(cacheKey, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'StockSync-Inventory-Dashboard/1.0',
          Accept: 'text/csv,text/plain,*/*',
        },
      });

      if (!response.ok) {
        res.status(response.status).json({
          error: `Google Sheets returned HTTP ${response.status}`,
        });
        return;
      }

      const text = await response.text();
      if (
        text.trimStart().startsWith('<!DOCTYPE html') ||
        text.trimStart().startsWith('<html') ||
        text.includes('Sign in - Google Accounts')
      ) {
        res.status(403).json({
          error:
            'This Sales Google Sheet is not publicly accessible. Please publish to web as CSV or allow Anyone with the link to view.',
        });
        return;
      }

      const summary = aggregateSalesCsv(text);
      salesCache.set(cacheKey, { timestamp: Date.now(), data: summary });

      try {
        const idxPayload = buildSalesConsumptionIndex(text);
        consumptionIndexCache.set(cacheKey, { timestamp: Date.now(), data: idxPayload });
      } catch {
        // Ignore secondary index error
      }

      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(summary);
    } catch (err: any) {
      res.status(502).json({
        error: err?.message || 'Failed to fetch and aggregate sales CSV from Google.',
      });
    }
  });

  // Strict Month/Year/Simplified/Qty Consumption Index API per Google Apps Script specification
  app.get('/api/sales-consumption-index', async (req: Request, res: Response) => {
    const rawUrl =
      typeof req.query.url === 'string' && req.query.url.trim()
        ? req.query.url.trim()
        : DEFAULT_SALES_CSV_URL;
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      res.status(400).json({ error: 'Invalid sales sheet URL format' });
      return;
    }

    if (
      parsed.protocol !== 'https:' ||
      parsed.hostname !== 'docs.google.com' ||
      !parsed.pathname.startsWith('/spreadsheets/')
    ) {
      res.status(403).json({
        error: 'Only https://docs.google.com/spreadsheets/ links are allowed.',
      });
      return;
    }

    const cacheKey = parsed.toString();
    const cached = consumptionIndexCache.get(cacheKey);
    if (!forceRefresh && cached && Date.now() - cached.timestamp < SALES_CACHE_TTL_MS) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(cached.data);
      return;
    }

    try {
      const response = await fetch(cacheKey, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'StockSync-Inventory-Dashboard/1.0',
          Accept: 'text/csv,text/plain,*/*',
        },
      });

      if (!response.ok) {
        res.status(response.status).json({
          error: `Google Sheets returned HTTP ${response.status}`,
        });
        return;
      }

      const text = await response.text();
      if (
        text.trimStart().startsWith('<!DOCTYPE html') ||
        text.trimStart().startsWith('<html') ||
        text.includes('Sign in - Google Accounts')
      ) {
        res.status(403).json({
          error:
            'This Sales Google Sheet is not publicly accessible. Please publish to web as CSV or allow Anyone with the link to view.',
        });
        return;
      }

      const idxPayload = buildSalesConsumptionIndex(text);
      consumptionIndexCache.set(cacheKey, { timestamp: Date.now(), data: idxPayload });

      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(idxPayload);
    } catch (err: any) {
      res.status(502).json({
        error: err?.message || 'Failed to fetch sales CSV for consumption calculation.',
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
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
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
