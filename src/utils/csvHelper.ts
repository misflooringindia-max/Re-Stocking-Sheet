import { InventoryItem } from '../types/inventory';
import { resolveImageUrl } from './imageHelper';

export const DEFAULT_PUBLISHED_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vT-1JU1iWrr58Z3VMEBRAqTeovKDVUKnaete2bYvhjHJzccdiTyYF_BPGTGFqLkGn1K9YByc6bekdd0/pub?output=csv';

/**
 * Converts any Google Sheet share link or published link into a direct CSV export URL.
 * Supports:
 * 1) Published CSV links: https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv
 * 2) Published HTML links: https://docs.google.com/spreadsheets/d/e/2PACX-.../pubhtml
 * 3) Standard shared links: https://docs.google.com/spreadsheets/d/{ID}/edit...
 */
export function convertGoogleSheetUrlToCsv(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname !== 'docs.google.com' || !parsed.pathname.includes('/spreadsheets/')) {
      return null;
    }

    // Case 1: Published-to-web URL (/spreadsheets/d/e/2PACX-...)
    if (parsed.pathname.includes('/spreadsheets/d/e/')) {
      const pubMatch = parsed.pathname.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/);
      if (!pubMatch || !pubMatch[1]) return null;

      const pubId = pubMatch[1];
      const gid = parsed.searchParams.get('gid');
      const params = new URLSearchParams();
      if (gid) params.set('gid', gid);
      if (parsed.searchParams.get('single')) params.set('single', parsed.searchParams.get('single')!);
      params.set('output', 'csv');

      return `https://docs.google.com/spreadsheets/d/e/${pubId}/pub?${params.toString()}`;
    }

    // Case 2: Standard spreadsheet URL (/spreadsheets/d/{ID}/...)
    const idMatch = parsed.pathname.match(/\/spreadsheets(?:\/u\/\d+)?\/d\/([a-zA-Z0-9-_]+)/);
    if (idMatch && idMatch[1]) {
      const sheetId = idMatch[1];
      let gid = parsed.searchParams.get('gid');
      if (!gid && parsed.hash) {
        const hashMatch = parsed.hash.match(/gid=([0-9]+)/);
        if (hashMatch) gid = hashMatch[1];
      }
      return gid
        ? `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
        : `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    }
  } catch {
    // Not a full URL — check if raw spreadsheet ID was pasted
    if (/^[a-zA-Z0-9-_]{25,}$/.test(trimmed)) {
      if (trimmed.startsWith('2PACX-')) {
        return `https://docs.google.com/spreadsheets/d/e/${trimmed}/pub?output=csv`;
      }
      return `https://docs.google.com/spreadsheets/d/${trimmed}/export?format=csv`;
    }
  }

  return null;
}

/**
 * Full RFC 4180 CSV parser supporting quoted commas, escaped quotes, and multiline cells
 */
function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];

    if (inQuotes) {
      if (char === '"') {
        if (csvText[i + 1] === '"') {
          currentVal += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentVal);
        currentVal = '';
      } else if (char === '\r') {
        if (csvText[i + 1] === '\n') i++;
        currentRow.push(currentVal);
        if (currentRow.some((c) => c.trim() !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentVal = '';
      } else if (char === '\n') {
        currentRow.push(currentVal);
        if (currentRow.some((c) => c.trim() !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal);
    if (currentRow.some((c) => c.trim() !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parses raw CSV text into an array of InventoryItems
 * Optimized for large datasets (3,500+ items)
 */
export function parseStockCsv(csvText: string, note = 'Initial import'): InventoryItem[] {
  if (!csvText || typeof csvText !== 'string') return [];

  const rows = parseCsvRows(csvText);
  if (rows.length === 0) return [];

  // Find header index
  let headerIdx = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const joined = rows[i].join(' ').toLowerCase();
    if (joined.includes('sku') || joined.includes('simplified') || joined.includes('stock')) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) headerIdx = 0;

  const headerCols = rows[headerIdx].map((h) => h.trim().toLowerCase());

  // Locate column positions with flexible matching
  const skuIdx = headerCols.findIndex((h) => h.includes('sku'));
  const simplifiedIdx = headerCols.findIndex((h) => h.includes('simplified') || h.includes('title') || h.includes('name'));
  const itemIdx = headerCols.findIndex((h) => h === 'item' || h.includes('category') || h.includes('product'));
  const colorIdx = headerCols.findIndex((h) => h.includes('color') || h.includes('colour'));
  const sizeIdx = headerCols.findIndex((h) => h.includes('size') || h.includes('dimension'));
  const stockIdx = headerCols.findIndex((h) => h.includes('stock') || h.includes('qty') || h.includes('quantity'));
  const imageIdx = headerCols.findIndex((h) => h === 'image');
  const eanIdx = headerCols.findIndex((h) => h.includes('ean') || h.includes('barcode'));
  const asinIdx = headerCols.findIndex((h) => h.includes('asin'));
  const mrpIdx = headerCols.findIndex((h) => h.includes('mrp') || h.includes('price'));
  const imageLinkIdx = headerCols.findIndex((h) => h.includes('image link') || h.includes('link') || h.includes('photo'));

  const items: InventoryItem[] = [];
  const now = new Date().toISOString();

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cols = rows[i];

    const sku = (cols[skuIdx >= 0 ? skuIdx : 0] || '').trim();
    const simplified = (cols[simplifiedIdx >= 0 ? simplifiedIdx : 1] || '').trim();

    // Skip empty lines
    if (!sku && !simplified) continue;

    const itemCategory = (cols[itemIdx >= 0 ? itemIdx : 2] || '').trim() || 'General';
    const color = (cols[colorIdx >= 0 ? colorIdx : 3] || '').trim() || 'Standard';
    const size = (cols[sizeIdx >= 0 ? sizeIdx : 4] || '').trim() || 'Standard';

    // Parse Stock quantity safely
    const rawStock = cols[stockIdx >= 0 ? stockIdx : 5] || '0';
    let stockNum = 0;
    if (
      rawStock &&
      !rawStock.includes('#N/A') &&
      !rawStock.includes('#REF!') &&
      !isNaN(Number(rawStock.trim()))
    ) {
      stockNum = Math.max(0, parseInt(rawStock.trim(), 10));
    }

    const imageCol = (cols[imageIdx >= 0 ? imageIdx : 6] || '').trim();
    const ean = (cols[eanIdx >= 0 ? eanIdx : 7] || '').trim();
    const asin = (cols[asinIdx >= 0 ? asinIdx : 8] || '').trim();

    // Parse MRP safely
    const rawMrp = cols[mrpIdx >= 0 ? mrpIdx : 9] || '0';
    let mrpNum = 0;
    const cleanMrp = rawMrp.replace(/[^0-9.]/g, '');
    if (cleanMrp && !isNaN(Number(cleanMrp))) {
      mrpNum = parseFloat(cleanMrp);
    }

    let imageLink = (cols[imageLinkIdx >= 0 ? imageLinkIdx : 10] || '').trim();
    if (!imageLink && imageCol && (imageCol.startsWith('http') || imageCol.toUpperCase().includes('=IMAGE'))) {
      imageLink = imageCol;
    }

    const resolvedImageUrl = resolveImageUrl(imageLink);

    items.push({
      id: `item-${i}-${sku || 'row'}`,
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
          changeNote: note,
        },
      ],
      updatedAt: now,
    });
  }

  return items;
}

/**
 * Converts InventoryItem array back to exact Google Sheet CSV format
 */
export function exportToCsv(items: InventoryItem[]): string {
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

  const escapeCol = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = items.map((item) => [
    escapeCol(item.sku),
    escapeCol(item.simplified),
    escapeCol(item.item),
    escapeCol(item.color),
    escapeCol(item.size),
    escapeCol(item.stock),
    escapeCol(item.imageCol),
    escapeCol(item.ean),
    escapeCol(item.asin),
    escapeCol(item.mrp),
    escapeCol(item.imageLink),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Converts InventoryItem array to TSV for 1-click clipboard paste directly into Google Sheets
 */
export function exportToTsv(items: InventoryItem[]): string {
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

  const rows = items.map((item) => [
    item.sku,
    item.simplified,
    item.item,
    item.color,
    item.size,
    item.stock,
    item.imageCol,
    item.ean,
    item.asin,
    item.mrp,
    item.imageLink,
  ]);

  return [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
}
