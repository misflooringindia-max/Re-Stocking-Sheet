import React, { useState, useEffect, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { convertGoogleSheetUrlToCsv } from '../utils/csvHelper';
import {
  MONTH_NAMES,
  MonthName,
  SalesConsumptionIndex,
  ConsumptionCalcOptions,
  dateValFromMonthYear,
  monthYearFromDateVal,
  formatDateValLabel,
  buildConsumptionIndexFromFile,
  aggregateSalesMapFromIndex,
  parseDelimitedTable,
  calculateReorderRows,
  buildReorderTableFromInventory,
  exportReorderTableCsv,
  exportReorderTableTsv,
  exportSingleColumnTsv,
} from '../utils/consumptionCalculator';
import {
  X,
  Calculator,
  Calendar,
  Upload,
  FileSpreadsheet,
  RefreshCw,
  Download,
  Copy,
  Check,
  Search,
  AlertCircle,
  ClipboardPaste,
  Boxes,
} from 'lucide-react';

interface ConsumptionCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SalesSourceMode = 'live' | 'upload';
type ReorderSourceMode = 'inventory' | 'paste' | 'upload' | 'url';
type RowFilter = 'all' | 'reorder' | 'matched' | 'unmatched' | 'ignored';

export const ConsumptionCalculatorModal: React.FC<ConsumptionCalculatorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { items, connectedSalesUrl, localSalesConsumptionIndex } = useInventory();

  // Source A: Sales_Data state
  const [salesMode, setSalesMode] = useState<SalesSourceMode>('live');
  const [salesUrlInput, setSalesUrlInput] = useState<string>(connectedSalesUrl);
  const [loadedSalesUrl, setLoadedSalesUrl] = useState<string>('');
  const [salesIndex, setSalesIndex] = useState<SalesConsumptionIndex | null>(null);
  const [salesFileName, setSalesFileName] = useState<string>('');
  const [isLoadingSales, setIsLoadingSales] = useState<boolean>(false);
  const [salesProgress, setSalesProgress] = useState<{ pct: number; rows: number } | null>(null);
  const [salesError, setSalesError] = useState<string | null>(null);

  // Date Range state (Step 1)
  const [fromMonth, setFromMonth] = useState<MonthName>('May');
  const [fromYear, setFromYear] = useState<number>(2026);
  const [toMonth, setToMonth] = useState<MonthName>('October');
  const [toYear, setToYear] = useState<number>(2026);
  const [rangeInitialized, setRangeInitialized] = useState<boolean>(false);

  // Source B: Re-Order_Data state
  const [reorderMode, setReorderMode] = useState<ReorderSourceMode>('inventory');
  const [rawReorderTable, setRawReorderTable] = useState<string[][]>([]);
  const [reorderSourceLabel, setReorderSourceLabel] = useState<string>('StockSync Inventory');
  const [pasteText, setPasteText] = useState<string>('');
  const [reorderUrlInput, setReorderUrlInput] = useState<string>('');
  const [isLoadingReorder, setIsLoadingReorder] = useState<boolean>(false);
  const [reorderError, setReorderError] = useState<string | null>(null);

  // Inventory-to-ReOrder defaults (when building from StockSync items)
  const [defaultLeadTime, setDefaultLeadTime] = useState<string>('15 Days');
  const [defaultSafetyFactorInput, setDefaultSafetyFactorInput] = useState<string>('1');
  const defaultSafetyFactor = useMemo(() => {
    const n = parseFloat(defaultSafetyFactorInput);
    return !n || isNaN(n) || n <= 0 ? 1 : n;
  }, [defaultSafetyFactorInput]);

  // Step 4: Downstream options
  const [enableDownstream, setEnableDownstream] = useState<boolean>(true);
  const [plannedWeeksInput, setPlannedWeeksInput] = useState<string>('8');
  const plannedWeeks = useMemo(() => {
    const n = parseFloat(plannedWeeksInput);
    return isNaN(n) || n < 0 ? 0 : n;
  }, [plannedWeeksInput]);

  // Preview filters & pagination
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [rowFilter, setRowFilter] = useState<RowFilter>('all');
  const [visibleLimit, setVisibleLimit] = useState<number>(100);
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);

  // Sync URL input when connectedSalesUrl changes from SyncModal
  useEffect(() => {
    setSalesUrlInput(connectedSalesUrl);
  }, [connectedSalesUrl]);

  // Apply preset helper relative to loaded Sales_Data date span
  const applyPresetRange = (idx: SalesConsumptionIndex, monthsBack: number | 'all') => {
    if (!idx.maxDateVal || !idx.minDateVal) return;
    if (monthsBack === 'all') {
      const start = monthYearFromDateVal(idx.minDateVal);
      const end = monthYearFromDateVal(idx.maxDateVal);
      setFromMonth(start.month);
      setFromYear(start.year);
      setToMonth(end.month);
      setToYear(end.year);
      return;
    }
    const endDv = idx.recommendedToDateVal || idx.maxDateVal;
    const startDv = Math.max(idx.minDateVal, endDv - (monthsBack - 1));
    const start = monthYearFromDateVal(startDv);
    const end = monthYearFromDateVal(endDv);
    setFromMonth(start.month);
    setFromYear(start.year);
    setToMonth(end.month);
    setToYear(end.year);
  };

  // Fetch live Sales_Data index when modal opens or URL updates
  const fetchLiveSalesIndex = async (forceRefresh = false, overrideUrl?: string) => {
    const rawTarget = (overrideUrl ?? salesUrlInput ?? connectedSalesUrl).trim();
    if (!rawTarget) {
      setSalesError('Please enter a Sales_Data Google Sheet URL.');
      return;
    }
    try {
      setIsLoadingSales(true);
      setSalesError(null);
      const csvUrl = convertGoogleSheetUrlToCsv(rawTarget) || rawTarget;
      const url = `/api/sales-consumption-index?url=${encodeURIComponent(csvUrl)}${
        forceRefresh ? '&refresh=1' : ''
      }&_t=${Date.now()}`;

      const attempt = async () => {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
          const isJson = (res.headers.get('content-type') || '').includes('application/json');
          const errJson = isJson ? await res.json().catch(() => null) : null;
          const err: any = new Error(errJson?.error || `HTTP ${res.status} loading sales sheet.`);
          err.status = res.status;
          err.isNonJsonEndpointError = !isJson;
          throw err;
        }
        return (await res.json()) as SalesConsumptionIndex;
      };

      let data: SalesConsumptionIndex;
      try {
        data = await attempt();
      } catch (firstErr: any) {
        if (firstErr?.isNonJsonEndpointError || !firstErr?.status || firstErr.status >= 500) {
          await new Promise((r) => setTimeout(r, 1200));
          try {
            data = await attempt();
          } catch (retryErr: any) {
            if (localSalesConsumptionIndex) {
              data = localSalesConsumptionIndex;
            } else if (
              (retryErr?.isNonJsonEndpointError || retryErr?.status === 404) &&
              (csvUrl.includes('1Xcyd7GOPosV2caGm-fj6ey3KlnvxkhmjcWkywsQVFeg') ||
                csvUrl.includes('2PACX-1vQDxz7MDyPeEDk6TFYU-vAeBPQT3rrZ6G3wXaL_4BQfKMphIBcdm2sbZS2DMYPD5pRbpENut1mI0ol3'))
            ) {
              const snapRes = await fetch('/data/sales-snapshot.json', { cache: 'no-store' });
              if (!snapRes.ok) throw retryErr;
              const snap = await snapRes.json();
              if (!snap?.index) throw retryErr;
              data = snap.index as SalesConsumptionIndex;
            } else {
              throw retryErr;
            }
          }
        } else {
          throw firstErr;
        }
      }

      setSalesIndex(data);
      setLoadedSalesUrl(rawTarget);
      if ((!rangeInitialized || forceRefresh) && data.maxDateVal > 0) {
        applyPresetRange(data, 6);
        setRangeInitialized(true);
      }
    } catch (err: any) {
      setSalesError(err?.message || 'Failed to load Sales_Data consumption index.');
    } finally {
      setIsLoadingSales(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (
      salesMode === 'live' &&
      !isLoadingSales &&
      (!salesIndex || loadedSalesUrl !== connectedSalesUrl)
    ) {
      fetchLiveSalesIndex(false, connectedSalesUrl);
    }
  }, [isOpen, salesMode, connectedSalesUrl]);

  // Keep Re-Order table seeded from StockSync inventory if user is in 'inventory' mode
  useEffect(() => {
    if (reorderMode === 'inventory') {
      const built = buildReorderTableFromInventory(items, defaultLeadTime, defaultSafetyFactor);
      setRawReorderTable(built);
      setReorderSourceLabel(`StockSync Inventory (${Math.max(0, built.length - 1).toLocaleString()} Simplified SKUs)`);
      setReorderError(null);
    }
  }, [reorderMode, items, defaultLeadTime, defaultSafetyFactor]);

  // Reset pagination on filter/search changes
  useEffect(() => {
    setVisibleLimit(100);
  }, [searchQuery, rowFilter, reorderMode, rawReorderTable]);

  // Available years computed from sales index or reasonable range
  const availableYears = useMemo(() => {
    const set = new Set<number>([2024, 2025, 2026, 2027, fromYear, toYear]);
    if (salesIndex?.availableDateVals) {
      for (const dv of salesIndex.availableDateVals) {
        set.add(monthYearFromDateVal(dv).year);
      }
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [salesIndex, fromYear, toYear]);

  const fromDateVal = useMemo(() => dateValFromMonthYear(fromMonth, fromYear), [fromMonth, fromYear]);
  const toDateVal = useMemo(() => dateValFromMonthYear(toMonth, toYear), [toMonth, toYear]);
  const selectedMonthCount = Math.max(0, toDateVal - fromDateVal + 1);

  // Step 1 & Step 2: Build case-sensitive salesMap
  const salesMap = useMemo(() => {
    if (!salesIndex) return {};
    return aggregateSalesMapFromIndex(salesIndex, fromDateVal, toDateVal);
  }, [salesIndex, fromDateVal, toDateVal]);

  const salesMapStats = useMemo(() => {
    const keys = Object.keys(salesMap);
    let totalUnits = 0;
    for (let i = 0; i < keys.length; i++) {
      totalUnits += salesMap[keys[i]];
    }
    return { uniqueKeys: keys.length, totalUnits };
  }, [salesMap]);

  // Step 3 & Step 4: Map & calculate Re-Order rows
  const { headers, rows: calculatedRows } = useMemo(() => {
    const opts: ConsumptionCalcOptions = {
      enableDownstream,
      plannedWeeks: isNaN(plannedWeeks) || plannedWeeks < 0 ? 0 : plannedWeeks,
    };
    return calculateReorderRows(rawReorderTable, salesMap, opts);
  }, [rawReorderTable, salesMap, enableDownstream, plannedWeeks]);

  // Summary KPIs
  const summaryStats = useMemo(() => {
    let matchedCount = 0;
    let unmatchedCount = 0;
    let totalConsumption = 0;
    let reorderItemsCount = 0;
    let totalReorderUnits = 0;
    let ignoredCount = 0;

    for (const r of calculatedRows) {
      if (r.hasSalesMatch) {
        matchedCount++;
      } else {
        unmatchedCount++;
      }
      totalConsumption += r.consumption;
      if (r.isIgnored) ignoredCount++;
      if (r.reorderQty > 0) {
        reorderItemsCount++;
        totalReorderUnits += r.reorderQty;
      }
    }

    return {
      totalRows: calculatedRows.length,
      matchedCount,
      unmatchedCount,
      totalConsumption,
      reorderItemsCount,
      totalReorderUnits,
      ignoredCount,
    };
  }, [calculatedRows]);

  // Filtered rows for preview
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return calculatedRows.filter((r) => {
      if (rowFilter === 'reorder' && r.reorderQty <= 0) return false;
      if (rowFilter === 'matched' && !r.hasSalesMatch) return false;
      if (rowFilter === 'unmatched' && r.hasSalesMatch) return false;
      if (rowFilter === 'ignored' && !r.isIgnored) return false;
      if (q) {
        const matchName = r.simplified.toLowerCase().includes(q);
        const matchStatus = r.status.toLowerCase().includes(q);
        if (!matchName && !matchStatus) return false;
      }
      return true;
    });
  }, [calculatedRows, rowFilter, searchQuery]);

  if (!isOpen) return null;

  const handleUploadSalesFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSalesMode('upload');
    setSalesFileName(file.name);
    setIsLoadingSales(true);
    setSalesError(null);
    setSalesProgress({ pct: 0, rows: 0 });

    try {
      const idx = await buildConsumptionIndexFromFile(file, (pct, rows) => {
        setSalesProgress({ pct, rows });
      });
      setSalesIndex(idx);
      if (idx.maxDateVal > 0) {
        applyPresetRange(idx, 6);
        setRangeInitialized(true);
      }
    } catch (err: any) {
      setSalesError(err?.message || 'Failed to parse local Sales_Data CSV.');
    } finally {
      setIsLoadingSales(false);
      setSalesProgress(null);
    }
  };

  const handleUploadReorderFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReorderError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) || '';
      const parsed = parseDelimitedTable(text);
      if (parsed.length < 2) {
        setReorderError('No data rows found in uploaded Re-Order_Data file.');
        return;
      }
      setRawReorderTable(parsed);
      setReorderSourceLabel(`${file.name} (${(parsed.length - 1).toLocaleString()} rows)`);
    };
    reader.readAsText(file);
  };

  const handleApplyPastedReorder = () => {
    setReorderError(null);
    const parsed = parseDelimitedTable(pasteText);
    if (parsed.length < 2) {
      setReorderError('Please paste at least a header row and 1 data row from Re-Order_Data.');
      return;
    }
    setRawReorderTable(parsed);
    setReorderSourceLabel(`Pasted sheet (${(parsed.length - 1).toLocaleString()} rows)`);
  };

  const handleLoadReorderUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = reorderUrlInput.trim();
    if (!raw) {
      setReorderError('Please paste a Google Sheet link for Re-Order_Data.');
      return;
    }
    const csvUrl = convertGoogleSheetUrlToCsv(raw) || raw;
    try {
      setIsLoadingReorder(true);
      setReorderError(null);
      const res = await fetch(`/api/sheet-csv?url=${encodeURIComponent(csvUrl)}&_t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `HTTP ${res.status} loading Re-Order_Data sheet.`);
      }
      const text = await res.text();
      const parsed = parseDelimitedTable(text);
      if (parsed.length < 2) {
        throw new Error('No product rows found in the linked Re-Order_Data sheet.');
      }
      setRawReorderTable(parsed);
      setReorderSourceLabel(`Google Sheet (${(parsed.length - 1).toLocaleString()} rows)`);
    } catch (err: any) {
      setReorderError(err?.message || 'Could not load Re-Order_Data Google Sheet.');
    } finally {
      setIsLoadingReorder(false);
    }
  };

  const handleRowCellUpdate = (
    sheetRowIndex: number,
    colIndex: number,
    newVal: string
  ) => {
    // sheetRowIndex is 1-based row number in table (header is row 1 -> index 0, data starts at rowIndex 2 -> index 1)
    const arrayIdx = sheetRowIndex - 1;
    setRawReorderTable((prev) => {
      if (!prev[arrayIdx]) return prev;
      const next = [...prev];
      const updatedRow = [...next[arrayIdx]];
      while (updatedRow.length <= Math.max(11, colIndex)) {
        updatedRow.push('');
      }
      updatedRow[colIndex] = newVal;
      next[arrayIdx] = updatedRow;
      return next;
    });
  };

  const handleCopy = async (target: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget(null), 2000);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  const handleDownloadCsv = () => {
    const csv = exportReorderTableCsv(headers, calculatedRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ReOrder_Consumption_${fromMonth.slice(0, 3)}${fromYear}_${toMonth.slice(0, 3)}${toYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const displayedRows = filteredRows.slice(0, visibleLimit);
  const hasMoreRows = visibleLimit < filteredRows.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[var(--overlay-bg)]">
      <div className="w-full max-w-6xl bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--table-divider)] bg-[var(--card-bg)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-[var(--surface-subtle)] text-[var(--text-muted)] border border-[var(--border)] shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-medium text-[var(--text-primary)] truncate">
                Sales consumption &amp; re-order calculator
              </h2>
              <p className="text-[12px] text-[var(--text-muted)] truncate">
                Exact Month/Year range consumption (Col D/F/G/H) mapped case-sensitively to Re-Order_Data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--table-hover)] transition-colors duration-150 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[var(--page-bg)]">
          {/* Two Configuration Cards: Source A (Sales_Data + Date Range) & Source B (Re-Order_Data + Downstream) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Card 1: Source A (Sales_Data) & Step 1 Date Filter */}
            <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
                  <h3 className="text-[14px] font-medium text-[var(--text-primary)]">
                    1. Sales_Data &amp; month range
                  </h3>
                </div>

                {/* Source A Toggle */}
                <div className="flex items-center gap-1 bg-[var(--surface-subtle)] p-0.5 rounded-lg border border-[var(--border)] text-[12px]">
                  <button
                    type="button"
                    onClick={() => {
                      setSalesMode('live');
                      fetchLiveSalesIndex(false, salesUrlInput);
                    }}
                    className={`px-2.5 py-1 rounded-[6px] border transition-colors duration-150 ${
                      salesMode === 'live'
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)] font-medium'
                        : 'bg-transparent text-[var(--text-primary)] border-transparent hover:bg-[var(--card-bg)] font-normal'
                    }`}
                  >
                    Live Google Sheet
                  </button>
                  <label
                    className={`cursor-pointer px-2.5 py-1 rounded-[6px] border transition-colors duration-150 ${
                      salesMode === 'upload'
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)] font-medium'
                        : 'bg-transparent text-[var(--text-primary)] border-transparent hover:bg-[var(--card-bg)] font-normal'
                    }`}
                  >
                    <span>Upload CSV</span>
                    <input
                      type="file"
                      accept=".csv,.tsv,.txt"
                      onChange={handleUploadSalesFile}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Optional Sales_Data URL Input in Live mode */}
              {salesMode === 'live' && (
                <div className="flex items-center gap-1.5 text-[12px]">
                  <input
                    type="text"
                    value={salesUrlInput}
                    onChange={(e) => setSalesUrlInput(e.target.value)}
                    placeholder="Sales_Data Google Sheet CSV/share URL"
                    className="flex-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[12px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                  />
                  <button
                    type="button"
                    disabled={isLoadingSales}
                    onClick={() => fetchLiveSalesIndex(true, salesUrlInput)}
                    className="px-2.5 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[12px] font-medium disabled:opacity-40 transition-colors duration-150 shrink-0"
                  >
                    Load
                  </button>
                </div>
              )}

              {/* Sales Status Line */}
              <div className="p-2.5 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-[12px]">
                <span className="text-[var(--text-muted)]">
                  {isLoadingSales ? (
                    salesProgress ? (
                      `Streaming CSV... ${salesProgress.pct}% (${salesProgress.rows.toLocaleString()} rows)`
                    ) : (
                      'Loading Sales_Data rows...'
                    )
                  ) : salesIndex ? (
                    <>
                      <span className="text-[var(--text-primary)] font-medium">
                        {salesIndex.qualifiedRows.toLocaleString()}
                      </span>{' '}
                      rows ({formatDateValLabel(salesIndex.minDateVal)} –{' '}
                      {formatDateValLabel(salesIndex.maxDateVal)}) •{' '}
                      <span className="text-[var(--text-primary)] font-medium">
                        {salesIndex.uniqueSimplified.toLocaleString()}
                      </span>{' '}
                      Simplified keys
                      {salesMode === 'upload' && salesFileName ? ` (${salesFileName})` : ''}
                    </>
                  ) : (
                    'Ready to load Sales_Data'
                  )}
                </span>

                {salesMode === 'live' && (
                  <button
                    type="button"
                    disabled={isLoadingSales}
                    onClick={() => fetchLiveSalesIndex(true, salesUrlInput)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[11px] font-medium text-[var(--text-primary)] disabled:opacity-40 transition-colors duration-150"
                  >
                    <RefreshCw className={`w-3 h-3 text-[var(--text-muted)] ${isLoadingSales ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                )}
              </div>

              {salesError && (
                <div className="p-2.5 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border)] text-[12px] text-[var(--status-out-text)] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{salesError}</span>
                </div>
              )}

              {/* Quick Range Presets */}
              {salesIndex && salesIndex.maxDateVal > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                  <span className="text-[var(--text-muted)] mr-1">Quick range:</span>
                  {[
                    { label: 'Last 6 months', val: 6 as const },
                    { label: 'Last 3 months', val: 3 as const },
                    { label: 'Last 12 months', val: 12 as const },
                    { label: 'All months', val: 'all' as const },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applyPresetRange(salesIndex, p.val)}
                      className="px-2.5 py-1 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[12px] font-normal transition-colors duration-150"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}

              {/* From / To Month & Year Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                <div className="space-y-1">
                  <label className="block text-[var(--text-muted)]">From (inclusive)</label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={fromMonth}
                      onChange={(e) => setFromMonth(e.target.value as MonthName)}
                      className="flex-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                    >
                      {MONTH_NAMES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <select
                      value={fromYear}
                      onChange={(e) => setFromYear(parseInt(e.target.value, 10))}
                      className="w-24 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                    >
                      {availableYears.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[var(--text-muted)]">To (inclusive)</label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={toMonth}
                      onChange={(e) => setToMonth(e.target.value as MonthName)}
                      className="flex-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                    >
                      {MONTH_NAMES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <select
                      value={toYear}
                      onChange={(e) => setToYear(parseInt(e.target.value, 10))}
                      className="w-24 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                    >
                      {availableYears.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="text-[12px] text-[var(--text-muted)] flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <span>
                  Window: <span className="font-medium text-[var(--text-primary)]">{selectedMonthCount}</span> month(s) •{' '}
                  <span className="font-mono">
                    dateVal {fromDateVal}..{toDateVal}
                  </span>
                </span>
                <span>
                  Range sales:{' '}
                  <span className="font-mono font-medium text-[var(--text-primary)]">
                    {salesMapStats.totalUnits.toLocaleString()}
                  </span>{' '}
                  units ({salesMapStats.uniqueKeys.toLocaleString()} SKUs)
                </span>
              </div>
              {fromDateVal > toDateVal && (
                <div className="p-2 rounded-lg bg-[var(--status-low-bg)] text-[var(--status-low-text)] text-[12px] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>"From" month is after "To" month. Please adjust the range so From ≤ To.</span>
                </div>
              )}
            </div>

            {/* Card 2: Source B (Re-Order_Data) & Step 4 Downstream Settings */}
            <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-[var(--text-muted)]" />
                  <h3 className="text-[14px] font-medium text-[var(--text-primary)]">
                    2. Re-Order_Data &amp; downstream rules
                  </h3>
                </div>

                {/* Source B Mode Selector */}
                <div className="flex flex-wrap items-center gap-1 bg-[var(--surface-subtle)] p-0.5 rounded-lg border border-[var(--border)] text-[12px]">
                  {[
                    { id: 'inventory', label: 'StockSync', icon: Boxes },
                    { id: 'paste', label: 'Paste sheet', icon: ClipboardPaste },
                    { id: 'upload', label: 'Upload CSV', icon: Upload },
                    { id: 'url', label: 'Sheet link', icon: FileSpreadsheet },
                  ].map((tab) => {
                    const active = reorderMode === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setReorderMode(tab.id as ReorderSourceMode);
                          setReorderError(null);
                        }}
                        className={`px-2 py-1 rounded-[6px] border transition-colors duration-150 ${
                          active
                            ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)] font-medium'
                            : 'bg-transparent text-[var(--text-primary)] border-transparent hover:bg-[var(--card-bg)] font-normal'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Source B Input Controls */}
              {reorderMode === 'inventory' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[12px]">
                  <div>
                    <label className="block text-[var(--text-muted)] mb-1">
                      Default Lead Time (Col F)
                    </label>
                    <input
                      type="text"
                      value={defaultLeadTime}
                      onChange={(e) => setDefaultLeadTime(e.target.value)}
                      placeholder="e.g. 15 Days"
                      className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--text-muted)] mb-1">
                      Default Safety Factor (Col L)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={defaultSafetyFactorInput}
                      onChange={(e) => setDefaultSafetyFactorInput(e.target.value)}
                      onBlur={() => setDefaultSafetyFactorInput(String(defaultSafetyFactor))}
                      className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[13px] font-mono text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                    />
                  </div>
                </div>
              )}

              {reorderMode === 'paste' && (
                <div className="space-y-2 text-[12px]">
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={3}
                    placeholder="Copy Re-Order_Data rows (Cols A..L, including header row) from Google Sheets and paste here..."
                    className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-2.5 text-[12px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[var(--text-muted)]">{reorderSourceLabel}</span>
                    <button
                      type="button"
                      onClick={handleApplyPastedReorder}
                      className="px-3 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] font-medium transition-colors duration-150"
                    >
                      Parse pasted data
                    </button>
                  </div>
                </div>
              )}

              {reorderMode === 'upload' && (
                <div className="p-2.5 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-[12px]">
                  <span className="text-[var(--text-muted)]">{reorderSourceLabel}</span>
                  <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] font-medium inline-flex items-center gap-1.5 transition-colors duration-150">
                    <Upload className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span>Choose Re-Order_Data CSV/TSV</span>
                    <input
                      type="file"
                      accept=".csv,.tsv,.txt"
                      onChange={handleUploadReorderFile}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {reorderMode === 'url' && (
                <form onSubmit={handleLoadReorderUrl} className="space-y-2 text-[12px]">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={reorderUrlInput}
                      onChange={(e) => setReorderUrlInput(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
                      className="flex-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[12px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                    />
                    <button
                      type="submit"
                      disabled={isLoadingReorder}
                      className="px-3 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] font-medium disabled:opacity-40 transition-colors duration-150"
                    >
                      {isLoadingReorder ? 'Loading...' : 'Load sheet'}
                    </button>
                  </div>
                  <div className="text-[var(--text-muted)]">{reorderSourceLabel}</div>
                </form>
              )}

              {reorderError && (
                <div className="p-2.5 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border)] text-[12px] text-[var(--status-out-text)] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{reorderError}</span>
                </div>
              )}

              {/* Step 4 Downstream Settings */}
              <div className="pt-2 border-t border-[var(--table-divider)] flex flex-wrap items-center justify-between gap-3 text-[12px]">
                <label className="flex items-center gap-2 text-[var(--text-primary)] font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={enableDownstream}
                    onChange={(e) => setEnableDownstream(e.target.checked)}
                    className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                  />
                  <span>Enable downstream Min Stock &amp; Re-Order Qty</span>
                </label>

                {enableDownstream && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[var(--text-muted)]">Planned weeks:</span>
                    {[4, 6, 8, 12].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setPlannedWeeksInput(String(w))}
                        className={`px-2 py-1 rounded-lg border text-[12px] transition-colors duration-150 ${
                          plannedWeeks === w
                            ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)] font-medium'
                            : 'bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--table-hover)] font-normal'
                        }`}
                      >
                        {w}w
                      </button>
                    ))}
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={plannedWeeksInput}
                      onChange={(e) => setPlannedWeeksInput(e.target.value)}
                      onBlur={() => setPlannedWeeksInput(String(plannedWeeks))}
                      className="w-16 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-2 py-1 text-[12px] font-mono text-center text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                    />
                  </div>
                )}
              </div>

              <div className="text-[11px] text-[var(--text-muted)]">
                Formulas: Min Stock = ceil(((Consumption ÷ 180) × LeadDays) × SF) • Re-Order Qty = max(0, ceil(((Consumption ÷ 24) × Weeks × SF + MinStock) − Stock))
              </div>
            </div>
          </div>

          {/* Summary KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Re-Order rows', value: summaryStats.totalRows.toLocaleString() },
              { label: 'Sales matched', value: summaryStats.matchedCount.toLocaleString() },
              { label: 'Total consumption', value: summaryStats.totalConsumption.toLocaleString() },
              { label: 'SKUs to re-order', value: summaryStats.reorderItemsCount.toLocaleString() },
              { label: 'Total re-order qty', value: summaryStats.totalReorderUnits.toLocaleString() },
              { label: 'Ignored / empty', value: summaryStats.ignoredCount.toLocaleString() },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="p-3 rounded-xl bg-[var(--card-bg)] border border-[var(--border)]"
              >
                <span className="text-[12px] text-[var(--text-muted)] block">{kpi.label}</span>
                <span className="text-[20px] font-medium font-mono text-[var(--text-primary)] mt-0.5 block">
                  {kpi.value}
                </span>
              </div>
            ))}
          </div>

          {/* Filter & Search Bar for Preview Table */}
          <div className="p-3 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
              {[
                { id: 'all', label: `All (${calculatedRows.length.toLocaleString()})` },
                { id: 'reorder', label: `Re-Order > 0 (${summaryStats.reorderItemsCount.toLocaleString()})` },
                { id: 'matched', label: `Matched (${summaryStats.matchedCount.toLocaleString()})` },
                { id: 'unmatched', label: `Unmatched (${summaryStats.unmatchedCount.toLocaleString()})` },
                { id: 'ignored', label: `Ignored (${summaryStats.ignoredCount.toLocaleString()})` },
              ].map((pill) => {
                const active = rowFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setRowFilter(pill.id as RowFilter)}
                    className={`px-2.5 py-1 rounded-lg border transition-colors duration-150 ${
                      active
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)] font-medium'
                        : 'bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--table-hover)] font-normal'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by Simplified or Status..."
                className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* Preview Table */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px] border-collapse">
                <thead>
                  <tr className="bg-[var(--table-header-bg)] border-b border-[var(--table-divider)] text-[var(--text-muted)] font-medium">
                    <th className="py-2.5 px-3 font-medium">Row</th>
                    <th className="py-2.5 px-3 font-medium min-w-[200px]">Simplified (Col A)</th>
                    <th className="py-2.5 px-2.5 font-medium text-right whitespace-nowrap">
                      Consumption (Col C)
                    </th>
                    <th className="py-2.5 px-2.5 font-medium text-right">Stock (Col D)</th>
                    <th className="py-2.5 px-2.5 font-medium">Lead Time (Col F)</th>
                    <th className="py-2.5 px-2.5 font-medium">Status (Col H)</th>
                    <th className="py-2.5 px-2.5 font-medium text-right">SF (Col L)</th>
                    <th className="py-2.5 px-2.5 font-medium text-right whitespace-nowrap">
                      Min Stock (Col G)
                    </th>
                    <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">
                      Re-Order Qty (Col E)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--table-divider)] text-[var(--text-primary)] font-normal">
                  {displayedRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-[var(--text-muted)]">
                        No Re-Order_Data rows match the current filter.
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((r) => (
                      <tr
                        key={`${r.rowIndex}-${r.simplified}`}
                        className="hover:bg-[var(--table-hover)] transition-colors duration-150"
                      >
                        <td className="py-2 px-3 font-mono text-[var(--text-muted)]">
                          {r.rowIndex}
                        </td>
                        <td className="py-2 px-3 font-medium text-[var(--text-primary)]">
                          {r.simplified || (
                            <span className="text-[var(--text-muted)] font-normal italic">(Empty)</span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 font-mono font-medium text-right">
                          {r.consumption.toLocaleString()}
                        </td>
                        <td className="py-2 px-2.5 text-right">
                          <input
                            type="number"
                            value={r.rawRow[3] ?? '0'}
                            onChange={(e) => handleRowCellUpdate(r.rowIndex, 3, e.target.value)}
                            className="w-16 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-1.5 py-0.5 text-right font-mono text-[12px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                          />
                        </td>
                        <td className="py-2 px-2.5">
                          <input
                            type="text"
                            value={r.rawRow[5] ?? ''}
                            onChange={(e) => handleRowCellUpdate(r.rowIndex, 5, e.target.value)}
                            placeholder="Days / IGNORE"
                            className="w-28 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-2 py-0.5 text-[12px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                          />
                        </td>
                        <td className="py-2 px-2.5">
                          <input
                            type="text"
                            value={r.rawRow[7] ?? ''}
                            onChange={(e) => handleRowCellUpdate(r.rowIndex, 7, e.target.value)}
                            placeholder="Status / IGNORE"
                            className="w-28 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-2 py-0.5 text-[12px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                          />
                        </td>
                        <td className="py-2 px-2.5 text-right">
                          <input
                            type="number"
                            step="0.1"
                            value={r.rawRow[11] ?? '1'}
                            onChange={(e) => handleRowCellUpdate(r.rowIndex, 11, e.target.value)}
                            className="w-14 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-1.5 py-0.5 text-right font-mono text-[12px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                          />
                        </td>
                        <td className="py-2 px-2.5 font-mono text-right text-[var(--text-primary)]">
                          {r.isIgnored ? (
                            <span className="text-[var(--text-muted)]">0 (ignored)</span>
                          ) : (
                            r.minStock.toLocaleString()
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono font-medium text-right">
                          {r.isIgnored ? (
                            <span className="text-[var(--text-muted)] font-normal">0</span>
                          ) : r.reorderQty > 0 ? (
                            <span className="text-[var(--accent)]">{r.reorderQty.toLocaleString()}</span>
                          ) : (
                            <span className="text-[var(--text-muted)] font-normal">0</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {hasMoreRows && (
              <div className="p-3 border-t border-[var(--table-divider)] bg-[var(--card-bg)] flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setVisibleLimit((n) => n + 150)}
                  className="px-3.5 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[12px] font-medium text-[var(--text-primary)] transition-colors duration-150"
                >
                  Show next 150 rows ({(filteredRows.length - visibleLimit).toLocaleString()} remaining)
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleLimit(filteredRows.length)}
                  className="px-3.5 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-150"
                >
                  Show all {filteredRows.length.toLocaleString()}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Export Actions */}
        <div className="p-4 border-t border-[var(--table-divider)] bg-[var(--card-bg)] flex flex-wrap items-center justify-between gap-2">
          <div className="text-[12px] text-[var(--text-muted)]">
            Showing {displayedRows.length.toLocaleString()} of {filteredRows.length.toLocaleString()} filtered rows
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              {
                id: 'colC',
                label: 'Copy Col C (Consumption)',
                action: () =>
                  handleCopy('colC', exportSingleColumnTsv(calculatedRows, 'consumption')),
              },
              {
                id: 'colG',
                label: 'Copy Col G (Min Stock)',
                action: () =>
                  handleCopy('colG', exportSingleColumnTsv(calculatedRows, 'minStock')),
              },
              {
                id: 'colE',
                label: 'Copy Col E (Re-Order Qty)',
                action: () =>
                  handleCopy('colE', exportSingleColumnTsv(calculatedRows, 'reorderQty')),
              },
              {
                id: 'fullTsv',
                label: 'Copy Full Sheet (TSV)',
                action: () =>
                  handleCopy('fullTsv', exportReorderTableTsv(headers, calculatedRows)),
              },
            ].map((btn) => (
              <button
                key={btn.id}
                type="button"
                disabled={calculatedRows.length === 0}
                onClick={btn.action}
                className="px-3 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] disabled:opacity-40 text-[var(--text-primary)] text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150"
              >
                {copiedTarget === btn.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span>{btn.label}</span>
                  </>
                )}
              </button>
            ))}

            {/* Primary Action: Download Updated CSV */}
            <button
              type="button"
              disabled={calculatedRows.length === 0}
              onClick={handleDownloadCsv}
              className="px-4 py-2 rounded-lg bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] disabled:opacity-40 text-white text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150"
            >
              <Download className="w-4 h-4 text-white" />
              <span>Download updated CSV</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
