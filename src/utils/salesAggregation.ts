export interface SalesAggregationRecord {
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

export interface SalesSummaryPayload {
  schemaVersion: number;
  bySimplified: Record<string, SalesAggregationRecord>;
  totalRows: number;
  totalUnits: number;
  uniqueSimplified: number;
  minDate: string;
  maxDate: string;
  availableMonths: string[];
  windowLabels: {
    m1: string;
    m3: string;
    m6: string;
    m12: string;
  };
  syncedAt: string;
}

export interface DailySalesBucket {
  dateIso: string;
  unitsByKey: Record<string, number>;
}

export interface SalesConsumptionIndexPayload {
  bySimplifiedMonths: Record<string, Record<number, number>>;
  availableDateVals: number[];
  monthlyTotals: Record<number, number>;
  recommendedToDateVal: number;
  minDateVal: number;
  maxDateVal: number;
  totalRows: number;
  qualifiedRows: number;
  uniqueSimplified: number;
  syncedAt: string;
}

export const SALES_SUMMARY_SCHEMA_VERSION = 3;

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

const SHORT_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatDateValShort(dv: number): string {
  if (!dv) return '';
  const m = ((dv - 1) % 12 + 12) % 12;
  const y = Math.floor((dv - 1) / 12);
  return `${SHORT_MONTH_NAMES[m] || 'Jan'} ${y}`;
}

function formatDateValSpan(fromDv: number, toDv: number): string {
  if (!fromDv || !toDv) return '';
  if (fromDv === toDv) return formatDateValShort(toDv);
  return `${formatDateValShort(fromDv)}–${formatDateValShort(toDv)}`;
}

function parseNumericQty(raw: string | undefined): number {
  const cleaned = (raw ?? '').toString().trim().replace(/,/g, '');
  if (!cleaned) return 0;
  const val = parseFloat(cleaned);
  return Number.isFinite(val) ? val : 0;
}

export function parseSalesCsvLine(line: string): string[] {
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

export function buildSalesConsumptionIndex(csvText: string): SalesConsumptionIndexPayload {
  const lines = csvText.split(/\r?\n/);
  if (lines.length === 0) {
    throw new Error('Sales CSV is empty.');
  }

  const bySimplifiedMonths: Record<string, Record<number, number>> = Object.create(null);
  const monthlyTotals: Record<number, number> = Object.create(null);
  const dateValSet = new Set<number>();
  let totalRows = 0;
  let qualifiedRows = 0;
  let minDateVal = Infinity;
  let maxDateVal = -Infinity;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    totalRows++;

    const cols = line.includes('"') ? parseSalesCsvLine(line) : line.split(',');

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

    const qty = parseNumericQty(cols[3]);

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

export function aggregateSalesCsv(csvText: string): {
  summary: SalesSummaryPayload;
  dailyBuckets: DailySalesBucket[];
} {
  const lines = csvText.split(/\r?\n/);
  if (lines.length === 0) {
    throw new Error('Sales CSV is empty.');
  }

  let headerIdx = 0;
  let headerCols: string[] = [];
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    if (!lines[i].trim()) continue;
    const cols = parseSalesCsvLine(lines[i]).map((c) => c.trim().toLowerCase());
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

  interface CompactSaleRow {
    key: string;
    displayName: string;
    qty: number;
    dateVal: number | null;
    ym: string;
    portal: string;
  }

  const compactRows: CompactSaleRow[] = [];
  let minDateMs = Infinity;
  let maxDateMs = -Infinity;
  let totalUnits = 0;
  const monthSet = new Set<string>();
  const dateValUnits: Record<number, number> = Object.create(null);
  const dateValDays: Record<number, Set<string>> = Object.create(null);
  const dailyMap = new Map<string, Record<string, number>>();

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;

    const cols = line.includes('"') ? parseSalesCsvLine(line) : line.split(',');

    const rawSimplified = (cols[effSimplifiedIdx] || '').trim();
    if (!rawSimplified) continue;

    const key = rawSimplified.toLowerCase();
    const qty = Math.max(0, parseNumericQty(cols[effQtyIdx]));

    const rawDate = cols[effDateIdx] || '';
    const rawMonth = cols[effMonthIdx] || '';
    const rawYear = cols[effYearIdx] || '';

    let dateVal: number | null = null;
    let ym = '';
    const mZero = MONTH_MAP[rawMonth.trim().toLowerCase()];
    const yr = parseInt(rawYear.trim(), 10);
    if (mZero !== undefined && !isNaN(yr) && yr >= 2000 && yr <= 2100) {
      const mNum = mZero + 1;
      dateVal = yr * 12 + mNum;
      ym = `${yr}-${String(mNum).padStart(2, '0')}`;
      monthSet.add(ym);
    }

    const dateMs = parseSalesDateMs(rawDate, rawMonth, rawYear);
    if (dateMs !== null) {
      if (dateMs < minDateMs) minDateMs = dateMs;
      if (dateMs > maxDateMs) maxDateMs = dateMs;
      const dateIso = new Date(dateMs).toISOString().slice(0, 10);
      if (dateVal === null) {
        const d = new Date(dateMs);
        const y = d.getUTCFullYear();
        const mNum = d.getUTCMonth() + 1;
        dateVal = y * 12 + mNum;
        ym = `${y}-${String(mNum).padStart(2, '0')}`;
        monthSet.add(ym);
      }
      if (!dateValDays[dateVal]) dateValDays[dateVal] = new Set();
      dateValDays[dateVal].add(dateIso);

      let dayUnits = dailyMap.get(dateIso);
      if (!dayUnits) {
        dayUnits = Object.create(null) as Record<string, number>;
        dailyMap.set(dateIso, dayUnits);
      }
      dayUnits[key] = (dayUnits[key] || 0) + qty;
    }

    if (dateVal !== null) {
      dateValUnits[dateVal] = (dateValUnits[dateVal] || 0) + qty;
    }

    const portal = (cols[effPortalIdx] || '').trim() || 'Other';
    totalUnits += qty;

    compactRows.push({
      key,
      displayName: rawSimplified,
      qty,
      dateVal,
      ym,
      portal,
    });
  }

  if (maxDateMs === -Infinity) {
    maxDateMs = Date.now();
    minDateMs = maxDateMs;
  }

  const sortedDateVals = Object.keys(dateValUnits)
    .map(Number)
    .sort((a, b) => a - b);
  let anchorDateVal = sortedDateVals.length > 0 ? sortedDateVals[sortedDateVals.length - 1] : 0;

  if (sortedDateVals.length >= 2) {
    const latestDv = sortedDateVals[sortedDateVals.length - 1];
    const prevDv = sortedDateVals[sortedDateVals.length - 2];
    const latestUnits = dateValUnits[latestDv] || 0;
    const prevUnits = dateValUnits[prevDv] || 0;
    const latestDays = dateValDays[latestDv]?.size || 0;
    if (prevUnits > 0 && latestUnits < prevUnits * 0.15 && latestDays <= 5) {
      anchorDateVal = prevDv;
    }
  }

  const from1m = anchorDateVal;
  const from3m = anchorDateVal ? anchorDateVal - 2 : 0;
  const from6m = anchorDateVal ? anchorDateVal - 5 : 0;
  const from12m = anchorDateVal ? anchorDateVal - 11 : 0;

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
    if (r.qty > 0) {
      rec.orders += 1;
    }

    if (r.dateVal !== null && anchorDateVal > 0) {
      if (r.dateVal === anchorDateVal) rec.m1 += r.qty;
      if (r.dateVal >= from3m && r.dateVal <= anchorDateVal) rec.m3 += r.qty;
      if (r.dateVal >= from6m && r.dateVal <= anchorDateVal) rec.m6 += r.qty;
      if (r.dateVal >= from12m && r.dateVal <= anchorDateVal) rec.m12 += r.qty;
    }

    if (r.ym) {
      rec.monthly[r.ym] = (rec.monthly[r.ym] || 0) + r.qty;
    }
    rec.portals[r.portal] = (rec.portals[r.portal] || 0) + r.qty;
  }

  const availableMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a));
  const dailyBuckets: DailySalesBucket[] = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dateIso, unitsByKey]) => ({ dateIso, unitsByKey }));

  return {
    summary: {
      schemaVersion: SALES_SUMMARY_SCHEMA_VERSION,
      bySimplified,
      totalRows: compactRows.length,
      totalUnits,
      uniqueSimplified: Object.keys(bySimplified).length,
      minDate: new Date(minDateMs).toISOString().slice(0, 10),
      maxDate: new Date(maxDateMs).toISOString().slice(0, 10),
      availableMonths,
      windowLabels: {
        m1: formatDateValSpan(from1m, anchorDateVal),
        m3: formatDateValSpan(from3m, anchorDateVal),
        m6: formatDateValSpan(from6m, anchorDateVal),
        m12: formatDateValSpan(from12m, anchorDateVal),
      },
      syncedAt: new Date().toISOString(),
    },
    dailyBuckets,
  };
}

export function computeRangeSalesFromBuckets(
  days: DailySalesBucket[],
  from: string,
  to: string
): {
  from: string;
  to: string;
  totalUnits: number;
  activeDays: number;
  uniqueSimplified: number;
  bySimplified: Record<string, number>;
} {
  const bySimplified: Record<string, number> = Object.create(null);
  let totalUnits = 0;
  let activeDays = 0;

  for (let i = 0; i < days.length; i++) {
    const bucket = days[i];
    if (bucket.dateIso < from) continue;
    if (bucket.dateIso > to) break;
    activeDays++;
    const entries = bucket.unitsByKey;
    for (const k in entries) {
      const q = entries[k];
      bySimplified[k] = (bySimplified[k] || 0) + q;
      totalUnits += q;
    }
  }

  return {
    from,
    to,
    totalUnits,
    activeDays,
    uniqueSimplified: Object.keys(bySimplified).length,
    bySimplified,
  };
}
