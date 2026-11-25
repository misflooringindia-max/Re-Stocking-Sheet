import { InventoryItem } from '../types/inventory';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export type MonthName = (typeof MONTH_NAMES)[number];

export const STRICT_MONTH_MAP: Record<string, number> = {
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

export interface SalesConsumptionIndex {
  bySimplifiedMonths: Record<string, Record<number, number>>;
  availableDateVals: number[];
  monthlyTotals?: Record<number, number>;
  recommendedToDateVal?: number;
  minDateVal: number;
  maxDateVal: number;
  totalRows: number;
  qualifiedRows: number;
  uniqueSimplified: number;
  syncedAt: string;
}

function parseNumericCell(raw: unknown): number {
  const cleaned = (raw ?? '').toString().trim().replace(/,/g, '');
  if (!cleaned) return NaN;
  return parseFloat(cleaned);
}

export interface CalculatedReorderRow {
  rowIndex: number; // 1-based sheet row (excluding header = row 2+)
  simplified: string;
  consumption: number;
  stock: number;
  leadTimeRaw: string;
  leadTimeDays: number;
  status: string;
  safetyFactor: number;
  minStock: number;
  reorderQty: number;
  isIgnored: boolean;
  hasSalesMatch: boolean;
  rawRow: string[];
}

export interface ConsumptionCalcOptions {
  enableDownstream: boolean;
  plannedWeeks: number;
}

export function dateValFromMonthYear(month: string, year: number): number {
  const m = STRICT_MONTH_MAP[month] || 1;
  return parseInt(String(year), 10) * 12 + m;
}

export function monthYearFromDateVal(dateVal: number): { month: MonthName; year: number } {
  const zeroBasedMonth = ((dateVal - 1) % 12 + 12) % 12;
  const year = Math.floor((dateVal - 1) / 12);
  return {
    month: MONTH_NAMES[zeroBasedMonth] || 'January',
    year,
  };
}

export function formatDateValLabel(dateVal: number): string {
  if (!dateVal) return '-';
  const { month, year } = monthYearFromDateVal(dateVal);
  return `${month.slice(0, 3)} ${year}`;
}

export function parseCsvLine(line: string): string[] {
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

/**
 * Parses CSV or TSV (e.g. copy-pasted directly from Google Sheets) into a 2D string array.
 */
export function parseDelimitedTable(rawText: string): string[][] {
  if (!rawText || typeof rawText !== 'string') return [];

  const firstNewline = rawText.indexOf('\n');
  const firstLine = firstNewline >= 0 ? rawText.slice(0, firstNewline) : rawText;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;

  // TSV path (e.g., direct copy/paste from Google Sheets)
  if (tabCount > 0 && tabCount >= commaCount) {
    return rawText
      .split(/\r?\n/)
      .filter((line) => line.length > 0)
      .map((line) => line.split('\t'));
  }

  // Full RFC 4180 CSV path
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < rawText.length; i++) {
    const char = rawText[i];
    if (inQuotes) {
      if (char === '"') {
        if (rawText[i + 1] === '"') {
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
        if (rawText[i + 1] === '\n') i++;
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
 * Streams and indexes a local Sales_Data CSV/TSV file (handles 290,000+ rows smoothly in chunks)
 * strictly following 0-based column indices:
 *   Index 3 (Col D): Qty
 *   Index 5 (Col F): Month (January..December)
 *   Index 6 (Col G): Year (integer)
 *   Index 7 (Col H): Simplified (trimmed, case-sensitive exact match)
 */
export async function buildConsumptionIndexFromFile(
  file: File,
  onProgress?: (percent: number, processedRows: number) => void
): Promise<SalesConsumptionIndex> {
  const bySimplifiedMonths: Record<string, Record<number, number>> = Object.create(null);
  const monthlyTotals: Record<number, number> = Object.create(null);
  const dateValSet = new Set<number>();
  let totalRows = 0;
  let qualifiedRows = 0;
  let minDateVal = Infinity;
  let maxDateVal = -Infinity;

  const reader = file.stream().getReader();
  const decoder = new TextDecoder('utf-8');
  let leftover = '';
  let isHeaderSkipped = false;
  let bytesRead = 0;
  let isTsv: boolean | null = null;

  const processLine = (line: string) => {
    if (!line || !line.trim()) return;

    if (!isHeaderSkipped) {
      isHeaderSkipped = true;
      const tabCount = (line.match(/\t/g) || []).length;
      const commaCount = (line.match(/,/g) || []).length;
      isTsv = tabCount > 0 && tabCount >= commaCount;
      return;
    }

    totalRows++;
    const cols = isTsv
      ? line.split('\t')
      : line.includes('"')
      ? parseCsvLine(line)
      : line.split(',');

    const monthName = (cols[5] ?? '').toString().trim();
    const monthNum = Object.prototype.hasOwnProperty.call(STRICT_MONTH_MAP, monthName)
      ? STRICT_MONTH_MAP[monthName]
      : undefined;
    if (monthNum === undefined) return;

    const yearNum = parseInt((cols[6] ?? '').toString().trim(), 10);
    if (isNaN(yearNum)) return;

    const key = (cols[7] ?? '').toString().trim();
    if (!key) return;

    let qty = parseNumericCell(cols[3]);
    if (isNaN(qty)) qty = 0;

    const dateVal = yearNum * 12 + monthNum;
    dateValSet.add(dateVal);
    if (dateVal < minDateVal) minDateVal = dateVal;
    if (dateVal > maxDateVal) maxDateVal = dateVal;

    monthlyTotals[dateVal] = (monthlyTotals[dateVal] || 0) + qty;

    let bucket = bySimplifiedMonths[key];
    if (!bucket) {
      bucket = Object.create(null);
      bySimplifiedMonths[key] = bucket;
    }
    bucket[dateVal] = (bucket[dateVal] || 0) + qty;
    qualifiedRows++;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    bytesRead += value.byteLength;
    const chunkText = leftover + decoder.decode(value, { stream: true });
    const lines = chunkText.split(/\r?\n/);
    leftover = lines.pop() || '';

    for (let i = 0; i < lines.length; i++) {
      processLine(lines[i]);
    }

    if (onProgress && file.size > 0) {
      onProgress(Math.min(99, Math.round((bytesRead / file.size) * 100)), totalRows);
    }

    // Yield briefly so UI remains responsive on huge files
    await new Promise((r) => setTimeout(r, 0));
  }

  leftover += decoder.decode();
  if (leftover) {
    processLine(leftover);
  }

  const availableDateVals = Array.from(dateValSet).sort((a, b) => a - b);
  if (availableDateVals.length === 0) {
    minDateVal = 0;
    maxDateVal = 0;
  }

  let recommendedToDateVal = maxDateVal;
  if (availableDateVals.length >= 2) {
    const latestDv = availableDateVals[availableDateVals.length - 1];
    const prevDv = availableDateVals[availableDateVals.length - 2];
    const latestUnits = monthlyTotals[latestDv] || 0;
    const prevUnits = monthlyTotals[prevDv] || 0;
    if (prevUnits > 0 && latestUnits < prevUnits * 0.15) {
      recommendedToDateVal = prevDv;
    }
  }

  if (onProgress) {
    onProgress(100, totalRows);
  }

  return {
    bySimplifiedMonths,
    availableDateVals,
    monthlyTotals,
    recommendedToDateVal,
    minDateVal,
    maxDateVal,
    totalRows,
    qualifiedRows,
    uniqueSimplified: Object.keys(bySimplifiedMonths).length,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Step 1 & Step 2: Aggregate consumption from indexed Sales_Data for an inclusive [fromDateVal, toDateVal] window.
 * Keys remain trimmed and strictly case-sensitive.
 */
export function aggregateSalesMapFromIndex(
  index: SalesConsumptionIndex,
  fromDateVal: number,
  toDateVal: number
): Record<string, number> {
  const salesMap: Record<string, number> = Object.create(null);
  const byMonths = index.bySimplifiedMonths;

  for (const key of Object.keys(byMonths)) {
    const monthBuckets = byMonths[key];
    let sum = 0;
    let hasInRange = false;

    for (const dvStr of Object.keys(monthBuckets)) {
      const dv = Number(dvStr);
      if (dv >= fromDateVal && dv <= toDateVal) {
        sum += monthBuckets[dv];
        hasInRange = true;
      }
    }

    if (hasInRange) {
      salesMap[key] = sum;
    }
  }

  return salesMap;
}

/**
 * Step 3 & Step 4: Map aggregated consumption onto Re-Order_Data and compute optional downstream fields.
 * Exact 0-based Re-Order_Data column indices:
 *   0 (Col A): Simplified (trimmed, case-sensitive exact match)
 *   2 (Col C): Last 6 month Consumption (output)
 *   3 (Col D): Stock (numeric, default 0)
 *   4 (Col E): Re-Order Qty Minimum (output)
 *   5 (Col F): Lead Time (From Indent to Receipt)
 *   6 (Col G): Minimum Stock to Re-Order (output)
 *   7 (Col H): Status
 *  11 (Col L): Safety Factor (default 1 if empty, 0, or non-numeric)
 */
export function calculateReorderRows(
  tableRows: string[][],
  salesMap: Record<string, number>,
  options: ConsumptionCalcOptions
): { headers: string[]; rows: CalculatedReorderRow[] } {
  if (!tableRows || tableRows.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeader = tableRows[0] || [];
  const defaultHeaders = [
    'Simplified',
    'Category',
    'Last 6 month Consumption',
    'Stock',
    'Re-Order Qty Minimum',
    'Lead Time (From Indent to Receipt)',
    'Minimum Stock to Re-Order',
    'Status',
    'Col I',
    'Col J',
    'Col K',
    'Safety Factor',
  ];

  const colCount = Math.max(12, rawHeader.length);
  const headers: string[] = [];
  for (let c = 0; c < colCount; c++) {
    headers.push(rawHeader[c] !== undefined && rawHeader[c] !== '' ? rawHeader[c] : defaultHeaders[c] || `Col ${c + 1}`);
  }

  const calculatedRows: CalculatedReorderRow[] = [];

  // Skip header row (index 0)
  for (let i = 1; i < tableRows.length; i++) {
    const row = tableRows[i];
    if (!row || row.every((cell) => !cell || !cell.toString().trim())) continue;

    const key = row[0] ? row[0].toString().trim() : '';
    const hasSalesMatch =
      key.length > 0 && Object.prototype.hasOwnProperty.call(salesMap, key);
    const consumption = hasSalesMatch ? salesMap[key] : 0;

    let currentStock = parseNumericCell(row[3]);
    if (isNaN(currentStock)) currentStock = 0;

    const leadTimeRaw = (row[5] ?? '').toString().trim();
    const status = (row[7] ?? '').toString().trim();

    let sf = parseNumericCell(row[11]);
    if (!sf || isNaN(sf)) sf = 1;

    const isIgnored =
      !key || /ignore/i.test(status) || /ignore/i.test(leadTimeRaw);

    let leadTimeDays = 0;
    const ltMatch = leadTimeRaw.match(/(\d+)/);
    if (ltMatch) {
      leadTimeDays = parseInt(ltMatch[1], 10);
    } else {
      const stMatch = status.match(/(\d+)/);
      if (stMatch) {
        leadTimeDays = parseInt(stMatch[1], 10);
      }
    }

    let minStock = parseNumericCell(row[6]);
    if (isNaN(minStock)) minStock = 0;
    let reorderQty = parseNumericCell(row[4]);
    if (isNaN(reorderQty)) reorderQty = 0;

    if (options.enableDownstream) {
      if (isIgnored) {
        minStock = 0;
        reorderQty = 0;
      } else {
        // Fixed 180 days per specification regardless of selected month count
        minStock = Math.ceil(((consumption / 180) * leadTimeDays) * sf);

        // Fixed 24 weeks per specification
        const baseQty = (consumption / 24) * options.plannedWeeks * sf;
        reorderQty = Math.ceil((baseQty + minStock) - currentStock);
        if (reorderQty < 0) reorderQty = 0;
      }
    }

    // Build updated rawRow copy preserving all columns
    const outColCount = Math.max(colCount, row.length);
    const updatedRaw = new Array<string>(outColCount).fill('');
    for (let c = 0; c < row.length; c++) {
      updatedRaw[c] = row[c] ?? '';
    }
    updatedRaw[2] = String(consumption);
    if (options.enableDownstream) {
      updatedRaw[4] = String(reorderQty);
      updatedRaw[6] = String(minStock);
    }

    calculatedRows.push({
      rowIndex: i + 1,
      simplified: key,
      consumption,
      stock: currentStock,
      leadTimeRaw,
      leadTimeDays,
      status,
      safetyFactor: sf,
      minStock,
      reorderQty,
      isIgnored,
      hasSalesMatch,
      rawRow: updatedRaw,
    });
  }

  return { headers, rows: calculatedRows };
}

/**
 * Generates a standard 12-column Re-Order_Data table from StockSync's live inventory
 * grouped by exact trimmed Simplified article name (summing SKU stock levels).
 */
export function buildReorderTableFromInventory(
  items: InventoryItem[],
  defaultLeadTime = '15 Days',
  defaultSafetyFactor = 1
): string[][] {
  const headers = [
    'Simplified',
    'Category',
    'Last 6 month Consumption',
    'Stock',
    'Re-Order Qty Minimum',
    'Lead Time (From Indent to Receipt)',
    'Minimum Stock to Re-Order',
    'Status',
    '',
    '',
    '',
    'Safety Factor',
  ];

  const grouped = new Map<string, { category: string; stock: number }>();

  for (const item of items) {
    const key = (item.simplified || '').trim();
    if (!key) continue;
    const existing = grouped.get(key);
    if (existing) {
      existing.stock += item.stock;
    } else {
      grouped.set(key, { category: item.item || '', stock: item.stock });
    }
  }

  const rows: string[][] = [headers];
  for (const [simplified, info] of grouped.entries()) {
    rows.push([
      simplified,
      info.category,
      '0',
      String(info.stock),
      '0',
      defaultLeadTime,
      '0',
      '',
      '',
      '',
      '',
      String(defaultSafetyFactor),
    ]);
  }

  return rows;
}

export function exportReorderTableCsv(headers: string[], rows: CalculatedReorderRow[]): string {
  const escapeCell = (val: string) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(row.rawRow.map(escapeCell).join(','));
  }
  return lines.join('\n');
}

export function exportReorderTableTsv(headers: string[], rows: CalculatedReorderRow[]): string {
  const lines = [headers.join('\t')];
  for (const row of rows) {
    lines.push(row.rawRow.map((v) => String(v ?? '').replace(/\t/g, ' ')).join('\t'));
  }
  return lines.join('\n');
}

export function exportSingleColumnTsv(
  rows: CalculatedReorderRow[],
  field: 'consumption' | 'reorderQty' | 'minStock'
): string {
  return rows.map((r) => String(r[field])).join('\n');
}
