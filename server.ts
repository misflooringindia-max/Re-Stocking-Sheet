import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

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
