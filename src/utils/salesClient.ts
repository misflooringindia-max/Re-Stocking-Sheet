import { SalesSummaryData } from '../types/inventory';
import { convertGoogleSheetUrlToCsv, fetchGoogleSheetCsvDirect } from './csvHelper';
import {
  aggregateSalesCsv,
  buildSalesConsumptionIndex,
  DailySalesBucket,
  SalesConsumptionIndexPayload,
} from './salesAggregation';

export const LEGACY_SALES_SHEET_ID =
  '2PACX-1vQDxz7MDyPeEDk6TFYU-vAeBPQT3rrZ6G3wXaL_4BQfKMphIBcdm2sbZS2DMYPD5pRbpENut1mI0ol3';
export const DEFAULT_SALES_SHEET_ID = '1Xcyd7GOPosV2caGm-fj6ey3KlnvxkhmjcWkywsQVFeg';

export function isKnownDefaultSalesUrl(url: string): boolean {
  if (!url) return false;
  return url.includes(DEFAULT_SALES_SHEET_ID) || url.includes(LEGACY_SALES_SHEET_ID);
}

let serverApiStatus: 'unknown' | 'available' | 'unavailable' = 'unknown';

export function isServerApiKnownUnavailable(): boolean {
  return serverApiStatus === 'unavailable';
}

export function markServerApiUnavailable(): void {
  serverApiStatus = 'unavailable';
}

export function isServerApiUnavailableError(err: any): boolean {
  return Boolean(
    err?.isStaticHost ||
      err?.isNonJsonEndpointError ||
      err?.status === 404 ||
      err?.status === 502 ||
      err?.status === 504
  );
}

/**
 * Fetches JSON from Express /api/* backend.
 * Detects static hosts (Netlify / CDN / SPA _redirects returning 404 or 200 text/html)
 * immediately and caches unavailability so subsequent calls never stall on doomed API retries.
 */
export async function fetchServerJson<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
  if (serverApiStatus === 'unavailable') {
    const err: any = new Error('Static host mode active');
    err.isStaticHost = true;
    err.isNonJsonEndpointError = true;
    throw err;
  }

  const res = await fetch(endpoint, { cache: 'no-store', signal });
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!isJson) {
    if (res.status === 404 || res.ok) {
      serverApiStatus = 'unavailable';
    }
    const err: any = new Error(
      res.ok ? 'Backend API returned HTML instead of JSON.' : `HTTP ${res.status} from ${endpoint}`
    );
    err.status = res.status;
    err.isNonJsonEndpointError = true;
    throw err;
  }

  if (!res.ok) {
    const errJson = await res.json().catch(() => null);
    const err: any = new Error(errJson?.error || `HTTP ${res.status} from ${endpoint}`);
    err.status = res.status;
    err.isNonJsonEndpointError = false;
    throw err;
  }

  serverApiStatus = 'available';
  return (await res.json()) as T;
}

export interface DirectSalesLoadResult {
  summary: SalesSummaryData;
  dailyBuckets: DailySalesBucket[];
  index: SalesConsumptionIndexPayload;
  fromSnapshot: boolean;
}

const inFlightDirectLoads = new Map<string, Promise<DirectSalesLoadResult>>();

/**
 * Loads & aggregates a Sales Google Sheet directly in the browser (using CORS-safe gviz/tq
 * and export?format=csv), falling back to /data/sales-snapshot.json if live fetch fails
 * for the default sales sheet. Deduplicates concurrent calls for the same URL.
 */
export async function loadSalesDirectOrSnapshot(
  rawUrl: string,
  signal?: AbortSignal
): Promise<DirectSalesLoadResult> {
  const csvUrl = convertGoogleSheetUrlToCsv(rawUrl) || rawUrl.trim();
  const dedupeKey = csvUrl || rawUrl.trim();

  const existing = inFlightDirectLoads.get(dedupeKey);
  if (existing && !signal) {
    return existing;
  }

  const run = async (): Promise<DirectSalesLoadResult> => {
    try {
      const csvText = await fetchGoogleSheetCsvDirect(rawUrl, signal);
      const { summary, dailyBuckets } = aggregateSalesCsv(csvText);
      const index = buildSalesConsumptionIndex(csvText);
      if (summary.totalRows === 0) {
        throw new Error('No sales rows found in the Google Sheet CSV.');
      }
      return {
        summary: {
          ...summary,
          sourceUrl: csvUrl,
        },
        dailyBuckets,
        index,
        fromSnapshot: false,
      };
    } catch (directErr: any) {
      if (directErr?.name === 'AbortError') throw directErr;

      if (isKnownDefaultSalesUrl(rawUrl) || isKnownDefaultSalesUrl(csvUrl)) {
        try {
          const snapRes = await fetch('/data/sales-snapshot.json', { cache: 'no-store', signal });
          if (snapRes.ok) {
            const snapType = snapRes.headers.get('content-type') || '';
            if (snapType.includes('application/json') || !snapType.includes('text/html')) {
              const snap = await snapRes.json();
              if (snap?.summary?.bySimplified) {
                return {
                  summary: {
                    ...snap.summary,
                    sourceUrl: csvUrl,
                  },
                  dailyBuckets: Array.isArray(snap.dailyBuckets) ? snap.dailyBuckets : [],
                  index: snap.index,
                  fromSnapshot: true,
                };
              }
            }
          }
        } catch (snapErr: any) {
          if (snapErr?.name === 'AbortError') throw snapErr;
        }
      }

      throw directErr;
    }
  };

  if (signal) {
    return run();
  }

  const promise = run().finally(() => {
    inFlightDirectLoads.delete(dedupeKey);
  });
  inFlightDirectLoads.set(dedupeKey, promise);
  return promise;
}
