import { InventoryItem } from '../types/inventory';
import { resolveImageUrl } from './imageHelper';

/**
 * Converts a Google Sheet URL into a direct CSV export URL
 */
export function convertGoogleSheetUrlToCsv(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const url = rawUrl.trim();

  // Match /spreadsheets/d/SHEET_ID
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match || !match[1]) return null;

  const sheetId = match[1];

  // Check if gid is present (e.g. #gid=0 or ?gid=123)
  const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

/**
 * Parses raw CSV text into an array of InventoryItems
 * Optimized for large datasets (3,500+ items)
 */
export function parseStockCsv(csvText: string): InventoryItem[] {
  if (!csvText || typeof csvText !== 'string') return [];

  // Normalize line breaks
  const lines = csvText.split(/\r?\n/);
  if (lines.length === 0) return [];

  // Find header index
  let headerIdx = -1;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const l = lines[i].toLowerCase();
    if (l.includes('sku') || l.includes('simplified') || l.includes('stock')) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) headerIdx = 0;

  const headerCols = splitCsvLine(lines[headerIdx]).map((h) => h.trim().toLowerCase());

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

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine || !rawLine.trim()) continue;

    const cols = splitCsvLine(rawLine);

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

    const imageLink = (cols[imageLinkIdx >= 0 ? imageLinkIdx : 10] || '').trim();
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
          changeNote: 'Initial import',
        },
      ],
      updatedAt: now,
    });
  }

  return items;
}

/**
 * Fast RFC 4180 CSV line splitter
 */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
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
