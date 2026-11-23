import { getAccessToken } from './googleAuth';
import { InventoryItem } from '../types/inventory';
import { resolveImageUrl } from '../utils/imageHelper';
import { parseStockCsv } from '../utils/csvHelper';

/**
 * Extracts spreadsheet ID from full URL or returns raw ID
 */
export function extractSpreadsheetId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // If full URL: https://docs.google.com/spreadsheets/d/1CALrK7itJNNGiMapwCM.../edit...
  const match = trimmed.match(/\/spreadsheets(?:\/u\/\d+)?\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }

  // Web published URL: /spreadsheets/d/e/2PACX-1v.../pubhtml
  const pubMatch = trimmed.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/);
  if (pubMatch && pubMatch[1]) {
    return pubMatch[1];
  }

  // If user pasted just the alphanumeric ID (typically 20+ chars)
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Extracts gid (sheet ID) from URL parameter if present
 */
export function extractGid(input: string): string | null {
  if (!input) return null;
  const match = input.match(/[#?&]gid=([0-9]+)/);
  return match ? match[1] : null;
}

export interface SheetTabInfo {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

export interface GoogleSheetMetadata {
  spreadsheetId: string;
  title: string;
  sheets: SheetTabInfo[];
}

/**
 * Reads spreadsheet metadata (sheet tabs, title) via Sheets API v4
 */
export async function fetchSpreadsheetMetadata(spreadsheetId: string): Promise<GoogleSheetMetadata> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated with Google. Please sign in first.');
  }

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties(sheetId,title,gridProperties)`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        err?.error?.message ||
          'Access denied. Please ensure you are signed in with the Google Account that has permission to view this spreadsheet.'
      );
    }
    if (res.status === 404) {
      throw new Error('Spreadsheet not found. Please double-check the Google Sheet URL or ID.');
    }
    throw new Error(err?.error?.message || `Failed to access spreadsheet (HTTP ${res.status}).`);
  }

  const data = await res.json();
  const title = data.properties?.title || 'Untitled Spreadsheet';
  const sheets: SheetTabInfo[] = (data.sheets || []).map((s: any) => ({
    sheetId: s.properties?.sheetId ?? 0,
    title: s.properties?.title || 'Sheet1',
    rowCount: s.properties?.gridProperties?.rowCount || 0,
    columnCount: s.properties?.gridProperties?.columnCount || 0,
  }));

  return {
    spreadsheetId,
    title,
    sheets,
  };
}

/**
 * Formats a sheet tab title safely for A1 range notation
 */
function formatRangeForSheet(sheetTitle: string): string {
  const cleanTitle = sheetTitle.replace(/'/g, "''");
  return `'${cleanTitle}'`;
}

/**
 * Fetches all rows from the specified sheet tab via Google Sheets API v4
 * Falls back to public CSV export endpoint if unauthenticated and publicly viewable
 */
export async function fetchSpreadsheetValues(
  spreadsheetId: string,
  sheetTitle?: string,
  preferredGid?: string
): Promise<{ items: InventoryItem[]; metadata?: GoogleSheetMetadata; usedTab: string }> {
  const token = await getAccessToken();

  // If token is available, use official Google Sheets API v4
  if (token) {
    let metadata: GoogleSheetMetadata | undefined;
    let targetTab = sheetTitle;

    try {
      metadata = await fetchSpreadsheetMetadata(spreadsheetId);
      if (!targetTab && metadata.sheets.length > 0) {
        // If preferred GID specified, find matching tab
        if (preferredGid) {
          const matchByGid = metadata.sheets.find((s) => String(s.sheetId) === String(preferredGid));
          if (matchByGid) {
            targetTab = matchByGid.title;
          }
        }
        if (!targetTab) {
          targetTab = metadata.sheets[0].title;
        }
      }
    } catch (metaErr) {
      console.warn('Could not read metadata:', metaErr);
    }

    const tabToQuery = targetTab || 'Sheet1';
    const range = formatRangeForSheet(tabToQuery);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      range
    )}?valueRenderOption=FORMATTED_VALUE`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to fetch sheet values (HTTP ${res.status})`);
    }

    const data = await res.json();
    const rows: any[][] = data.values || [];

    if (rows.length <= 1) {
      throw new Error(`Sheet tab '${tabToQuery}' appears to be empty or has only a header row.`);
    }

    const items = parseMatrixToInventoryItems(rows);
    return {
      items,
      metadata,
      usedTab: tabToQuery,
    };
  }

  // Fallback if not authenticated: Try Google Sheets public CSV export
  try {
    const gidParam = preferredGid ? `&gid=${preferredGid}` : '';
    const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gidParam}`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(exportUrl)}`;

    const res = await fetch(proxyUrl);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const csvText = await res.text();
    // Verify it's not an HTML login page
    if (csvText.includes('<!DOCTYPE html>') || csvText.includes('<html') || csvText.includes('Sign in - Google Accounts')) {
      throw new Error('This Google Sheet is private. Please sign in with your Google Account to grant access.');
    }

    const items = parseStockCsv(csvText);
    if (items.length === 0) {
      throw new Error('No valid items found in public sheet export.');
    }

    return {
      items,
      usedTab: 'Public Export',
    };
  } catch (publicErr: any) {
    if (publicErr.message?.includes('private') || publicErr.message?.includes('sign in')) {
      throw publicErr;
    }
    throw new Error('Could not access spreadsheet. Please sign in with your Google Account to authorize Google Sheets API.');
  }
}

/**
 * Parses Google Sheets 2D array into InventoryItem objects
 */
export function parseMatrixToInventoryItems(rows: any[][]): InventoryItem[] {
  // Find header row by scanning first 5 rows
  let headerIdx = -1;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const r = rows[i].map((c) => String(c || '').toLowerCase().trim());
    if (r.some((c) => c.includes('sku') || c.includes('simplified') || c.includes('stock'))) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) headerIdx = 0;

  const headers = rows[headerIdx].map((c) => String(c || '').toLowerCase().trim());

  const skuIdx = headers.findIndex((h) => h.includes('sku'));
  const simplifiedIdx = headers.findIndex((h) => h.includes('simplified') || h.includes('title') || h.includes('name'));
  const itemIdx = headers.findIndex((h) => h === 'item' || h.includes('category') || h.includes('product'));
  const colorIdx = headers.findIndex((h) => h.includes('color') || h.includes('colour'));
  const sizeIdx = headers.findIndex((h) => h.includes('size') || h.includes('dimension'));
  const stockIdx = headers.findIndex((h) => h.includes('stock') || h.includes('qty') || h.includes('quantity'));
  const imageIdx = headers.findIndex((h) => h === 'image');
  const eanIdx = headers.findIndex((h) => h.includes('ean') || h.includes('barcode'));
  const asinIdx = headers.findIndex((h) => h.includes('asin'));
  const mrpIdx = headers.findIndex((h) => h.includes('mrp') || h.includes('price'));
  const imageLinkIdx = headers.findIndex((h) => h.includes('image link') || h.includes('link') || h.includes('photo'));

  const items: InventoryItem[] = [];
  const now = new Date().toISOString();

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const sku = String(row[skuIdx >= 0 ? skuIdx : 0] || '').trim();
    const simplified = String(row[simplifiedIdx >= 0 ? simplifiedIdx : 1] || '').trim();

    // Skip empty separator rows
    if (!sku && !simplified) continue;

    const itemCategory = String(row[itemIdx >= 0 ? itemIdx : 2] || '').trim() || 'General';
    const color = String(row[colorIdx >= 0 ? colorIdx : 3] || '').trim() || 'Standard';
    const size = String(row[sizeIdx >= 0 ? sizeIdx : 4] || '').trim() || 'Standard';

    // Parse Stock Quantity
    const rawStock = String(row[stockIdx >= 0 ? stockIdx : 5] || '0').trim();
    let stockNum = 0;
    if (rawStock && !rawStock.includes('#N/A') && !rawStock.includes('#REF!') && !isNaN(Number(rawStock))) {
      stockNum = Math.max(0, parseInt(rawStock, 10));
    }

    const imageCol = String(row[imageIdx >= 0 ? imageIdx : 6] || '').trim();
    const ean = String(row[eanIdx >= 0 ? eanIdx : 7] || '').trim();
    const asin = String(row[asinIdx >= 0 ? asinIdx : 8] || '').trim();

    // Parse MRP Price
    const rawMrp = String(row[mrpIdx >= 0 ? mrpIdx : 9] || '0');
    let mrpNum = 0;
    const cleanMrp = rawMrp.replace(/[^0-9.]/g, '');
    if (cleanMrp && !isNaN(Number(cleanMrp))) {
      mrpNum = parseFloat(cleanMrp);
    }

    // Image Link & Fallback to Image Column
    let imageLink = String(row[imageLinkIdx >= 0 ? imageLinkIdx : 10] || '').trim();
    if (!imageLink && imageCol && (imageCol.startsWith('http') || imageCol.includes('=IMAGE'))) {
      imageLink = imageCol;
    }

    const resolvedImageUrl = resolveImageUrl(imageLink);

    items.push({
      id: `item-${i}-${sku || 'row'}-${Math.random().toString(36).substring(2, 6)}`,
      sku: sku || `SKU-${i}`,
      simplified: simplified || sku || `Item ${i}`,
      item: itemCategory,
      color,
      size,
      stock: stockNum,
      imageCol,
      ean,
      asin,
      mrp: mrpNum,
      imageLink,
      resolvedImageUrl,
      history: [
        {
          id: `init-${i}`,
          timestamp: now,
          field: 'STOCK',
          oldValue: stockNum,
          newValue: stockNum,
          changeNote: 'Google Sheet Live Sync',
        },
      ],
      updatedAt: now,
    });
  }

  return items;
}

/**
 * Updates Google Sheet values back with user confirmation
 */
export async function updateSpreadsheetFromInventory(
  spreadsheetId: string,
  items: InventoryItem[],
  sheetTitle?: string
): Promise<{ success: boolean; updatedRows: number }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated with Google. Please sign in first.');
  }

  const tabToUpdate = sheetTitle || 'Sheet1';
  const range = `${formatRangeForSheet(tabToUpdate)}!A1:K`;

  // Build matrix with headers
  const headers = [
    'Uniware SKU',
    'Simplified',
    'Item',
    'Color',
    'Size',
    'STOCK',
    'IMAGE',
    'EAN',
    'ASIN',
    'MRP',
    'Image Link',
  ];

  const rows = items.map((it) => [
    it.sku,
    it.simplified,
    it.item,
    it.color,
    it.size,
    it.stock,
    it.imageCol || '',
    it.ean || '',
    it.asin || '',
    it.mrp || 0,
    it.imageLink || '',
  ]);

  const body = {
    range,
    majorDimension: 'ROWS',
    values: [headers, ...rows],
  };

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}?valueInputOption=USER_ENTERED`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to update spreadsheet (HTTP ${res.status})`);
  }

  const result = await res.json();
  return {
    success: true,
    updatedRows: result.updatedRows || items.length,
  };
}
