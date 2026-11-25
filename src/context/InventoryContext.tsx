import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  InventoryItem,
  StockHistoryEntry,
  FilterOptions,
  SalesSummaryData,
  SalesRecord,
  SalesPeriod,
} from '../types/inventory';
import {
  DEFAULT_PUBLISHED_SHEET_URL,
  DEFAULT_SALES_SHEET_URL,
  parseStockCsv,
  exportToCsv,
  exportToTsv,
  convertGoogleSheetUrlToCsv,
} from '../utils/csvHelper';
import {
  saveItemsToDb,
  loadItemsFromDb,
  saveSalesSummaryToDb,
  loadSalesSummaryFromDb,
} from '../utils/db';
import initialCsvRaw from '../data/initialData.csv?raw';

interface SyncOptions {
  preserveLocalEdits?: boolean;
  silent?: boolean;
}

interface SyncResult {
  success: boolean;
  count: number;
  changedCount?: number;
  error?: string;
}

interface SalesSyncOptions {
  forceRefresh?: boolean;
}

interface SalesSyncResult {
  success: boolean;
  rows: number;
  uniqueSimplified: number;
  error?: string;
}

interface InventoryContextType {
  items: InventoryItem[];
  filteredItems: InventoryItem[];
  filters: FilterOptions;
  setFilters: React.Dispatch<React.SetStateAction<FilterOptions>>;
  updateStock: (id: string, newStock: number, note?: string) => void;
  updateSimplified: (id: string, newName: string) => void;
  updateItemField: (id: string, field: keyof InventoryItem, value: any) => void;
  quickAdjustStock: (id: string, delta: number) => void;
  batchUpdateStock: (updates: { id: string; stock: number; note?: string }[]) => void;
  importCsvData: (csvContent: string) => { success: boolean; count: number; error?: string };
  syncFromLiveSheet: (sheetUrl?: string, options?: SyncOptions) => Promise<SyncResult>;
  connectedSheetUrl: string;
  setConnectedSheetUrl: (url: string) => void;
  salesData: SalesSummaryData | null;
  connectedSalesUrl: string;
  setConnectedSalesUrl: (url: string) => void;
  isSyncingSales: boolean;
  salesSyncError: string | null;
  syncSalesSheet: (salesUrl?: string, options?: SalesSyncOptions) => Promise<SalesSyncResult>;
  getItemSales: (simplified: string, period?: SalesPeriod) => number;
  getItemSalesRecord: (simplified: string) => SalesRecord | null;
  autoSyncEnabled: boolean;
  setAutoSyncEnabled: (enabled: boolean) => void;
  isSyncing: boolean;
  syncError: string | null;
  modifiedCount: number;
  copyModifiedTsvToClipboard: () => Promise<boolean>;
  clearModifiedFlags: () => void;
  resetToDefault: () => void;
  exportCsv: () => void;
  copyTsvToClipboard: () => Promise<boolean>;
  isOnline: boolean;
  isLoading: boolean;
  loadingMessage: string;
  lastSyncTime: string;
  globalHistory: (StockHistoryEntry & { sku: string; simplified: string; itemId: string })[];
  categories: string[];
  colors: string[];
  sizes: string[];
  stats: {
    totalSkus: number;
    totalUnits: number;
    outOfStockCount: number;
    lowStockCount: number;
    healthyCount: number;
    inventoryValue: number;
    reorderCount: number;
    filteredSalesTotal: number;
  };
}

const DEFAULT_THRESHOLD = 15;
const SALES_SUMMARY_SCHEMA_VERSION = 2;
const SHEET_URL_STORAGE_KEY = 'stocksync_published_sheet_url';
const SALES_URL_STORAGE_KEY = 'stocksync_sales_sheet_url';
const AUTO_SYNC_STORAGE_KEY = 'stocksync_auto_sync_enabled';
const LAST_SYNC_TIME_KEY = 'stocksync_last_live_sync_time';

const InventoryContext = createContext<InventoryContextType | null>(null);

async function fetchSheetCsvText(rawSheetUrl: string): Promise<string> {
  const csvUrl = convertGoogleSheetUrlToCsv(rawSheetUrl) || rawSheetUrl.trim();
  if (!csvUrl) {
    throw new Error('Please enter a valid Google Sheet link.');
  }

  let lastError: Error | null = null;
  try {
    const proxyEndpoint = `/api/sheet-csv?url=${encodeURIComponent(csvUrl)}&_t=${Date.now()}`;
    const res = await fetch(proxyEndpoint, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      if (text && !text.trimStart().startsWith('<!DOCTYPE html') && !text.trimStart().startsWith('<html')) {
        return text;
      }
    } else {
      const errJson = await res.json().catch(() => null);
      if (errJson?.error) {
        lastError = new Error(errJson.error);
      }
    }
  } catch (err: any) {
    lastError = err;
  }

  try {
    const res = await fetch(csvUrl, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const text = await res.text();
    if (text.trimStart().startsWith('<!DOCTYPE html') || text.trimStart().startsWith('<html')) {
      throw new Error('Google Sheet is private. Please publish to web as CSV or allow Anyone with the link to view.');
    }
    return text;
  } catch (directErr: any) {
    throw lastError || directErr || new Error('Could not reach Google Sheet. Check your internet connection and link.');
  }
}

function deduplicateItemIds(list: InventoryItem[]): { items: InventoryItem[]; hadDuplicates: boolean } {
  const seen = new Set<string>();
  let hadDuplicates = false;
  const deduped = list.map((it, idx) => {
    let candidate = it.id;
    if (!candidate || seen.has(candidate)) {
      hadDuplicates = true;
      candidate = `item-${idx}-${it.sku || 'row'}-${Math.random().toString(36).slice(2, 6)}`;
      while (seen.has(candidate)) {
        candidate = `item-${idx}-${Math.random().toString(36).slice(2, 8)}`;
      }
    }
    seen.add(candidate);
    return candidate === it.id ? it : { ...it, id: candidate };
  });
  return { items: deduped, hadDuplicates };
}

function mergeSheetItems(
  incoming: InventoryItem[],
  existing: InventoryItem[],
  preserveLocalEdits: boolean
): { merged: InventoryItem[]; changedCount: number } {
  const buckets = new Map<string, InventoryItem[]>();
  existing.forEach((it) => {
    const key = it.sku.trim().toLowerCase();
    if (!key) return;
    const list = buckets.get(key);
    if (list) {
      list.push(it);
    } else {
      buckets.set(key, [it]);
    }
  });

  const usedIds = new Set<string>();
  const claimUniqueId = (preferredId: string, idx: number, sku: string): string => {
    let candidate = preferredId;
    if (!candidate || usedIds.has(candidate)) {
      candidate = `item-${idx}-${sku || 'row'}`;
      let suffix = 1;
      while (usedIds.has(candidate)) {
        candidate = `item-${idx}-${sku || 'row'}-${suffix++}`;
      }
    }
    usedIds.add(candidate);
    return candidate;
  };

  const now = new Date().toISOString();
  let changedCount = 0;

  const merged = incoming.map((freshItem, idx) => {
    const key = freshItem.sku.trim().toLowerCase();
    const bucket = key ? buckets.get(key) : undefined;
    let prev: InventoryItem | undefined;

    if (bucket && bucket.length > 0) {
      const exactIdx = bucket.findIndex(
        (b) =>
          (freshItem.ean && b.ean === freshItem.ean) ||
          (freshItem.asin && b.asin === freshItem.asin) ||
          b.simplified.trim().toLowerCase() === freshItem.simplified.trim().toLowerCase()
      );
      if (exactIdx >= 0) {
        prev = bucket.splice(exactIdx, 1)[0];
      } else {
        prev = bucket.shift();
      }
    }

    if (!prev) {
      changedCount++;
      const uniqueId = claimUniqueId(freshItem.id, idx, freshItem.sku);
      return {
        ...freshItem,
        id: uniqueId,
        history: [
          {
            id: `sync-new-${idx}-${Date.now()}`,
            timestamp: now,
            field: 'SYNC' as const,
            oldValue: 'New',
            newValue: freshItem.stock,
            changeNote: 'Synced from Google Sheet',
          },
        ],
      };
    }

    const uniqueId = claimUniqueId(prev.id, idx, freshItem.sku);

    if (preserveLocalEdits && prev.locallyModified) {
      return {
        ...freshItem,
        id: uniqueId,
        simplified: prev.simplified,
        stock: prev.stock,
        mrp: prev.mrp,
        history: prev.history,
        updatedAt: prev.updatedAt,
        locallyModified: true,
      };
    }

    let nextHistory = [...(prev.history || [])];
    const stockChanged = prev.stock !== freshItem.stock;
    const nameChanged = prev.simplified !== freshItem.simplified;

    if (stockChanged) {
      changedCount++;
      nextHistory = [
        {
          id: `sync-stk-${idx}-${Date.now()}`,
          timestamp: now,
          field: 'SYNC' as const,
          oldValue: prev.stock,
          newValue: freshItem.stock,
          changeNote: 'Updated from live Google Sheet',
        },
        ...nextHistory,
      ].slice(0, 5);
    } else if (nameChanged) {
      changedCount++;
      nextHistory = [
        {
          id: `sync-name-${idx}-${Date.now()}`,
          timestamp: now,
          field: 'SYNC' as const,
          oldValue: prev.simplified,
          newValue: freshItem.simplified,
          changeNote: 'Name updated from live Google Sheet',
        },
        ...nextHistory,
      ].slice(0, 5);
    }

    return {
      ...freshItem,
      id: uniqueId,
      history: nextHistory,
      updatedAt: stockChanged || nameChanged ? now : prev.updatedAt,
      locallyModified: false,
    };
  });

  return { merged, changedCount };
}

function getSalesValueForRecord(rec: SalesRecord | undefined, period: SalesPeriod): number {
  if (!rec) return 0;
  if (period === '1m') return rec.m1;
  if (period === '3m') return rec.m3;
  if (period === '6m') return rec.m6;
  if (period === '12m') return rec.m12;
  if (period === 'all') return rec.total;
  if (period.startsWith('month:')) {
    const ym = period.slice(6);
    return rec.monthly[ym] || 0;
  }
  return rec.m3;
}

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<InventoryItem[]>(() => parseStockCsv(initialCsvRaw));
  const itemsRef = useRef<InventoryItem[]>(items);
  itemsRef.current = items;

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('Loading database...');
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastSyncTime, setLastSyncTime] = useState<string>(
    () => localStorage.getItem(LAST_SYNC_TIME_KEY) || new Date().toISOString()
  );

  const [connectedSheetUrl, setConnectedSheetUrlState] = useState<string>(
    () => localStorage.getItem(SHEET_URL_STORAGE_KEY) || DEFAULT_PUBLISHED_SHEET_URL
  );
  const [connectedSalesUrl, setConnectedSalesUrlState] = useState<string>(
    () => localStorage.getItem(SALES_URL_STORAGE_KEY) || DEFAULT_SALES_SHEET_URL
  );
  const [salesData, setSalesData] = useState<SalesSummaryData | null>(null);
  const [isSyncingSales, setIsSyncingSales] = useState<boolean>(false);
  const [salesSyncError, setSalesSyncError] = useState<string | null>(null);

  const [autoSyncEnabled, setAutoSyncEnabledState] = useState<boolean>(() => {
    const saved = localStorage.getItem(AUTO_SYNC_STORAGE_KEY);
    return saved === null ? true : saved === 'true';
  });

  const isInitialLoad = useRef(true);

  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    category: 'all',
    color: 'all',
    size: 'all',
    status: 'all',
    sortBy: 'stock-asc',
    lowStockThreshold: DEFAULT_THRESHOLD,
    salesPeriod: '3m',
    salesActivity: 'all',
  });

  const setConnectedSheetUrl = useCallback((url: string) => {
    const trimmed = url.trim();
    setConnectedSheetUrlState(trimmed);
    localStorage.setItem(SHEET_URL_STORAGE_KEY, trimmed);
  }, []);

  const setConnectedSalesUrl = useCallback((url: string) => {
    const trimmed = url.trim();
    setConnectedSalesUrlState(trimmed);
    localStorage.setItem(SALES_URL_STORAGE_KEY, trimmed);
  }, []);

  const setAutoSyncEnabled = useCallback((enabled: boolean) => {
    setAutoSyncEnabledState(enabled);
    localStorage.setItem(AUTO_SYNC_STORAGE_KEY, String(enabled));
  }, []);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync Sales Summary from server-side aggregator
  const syncSalesSheet = useCallback(
    async (salesUrl?: string, options?: SalesSyncOptions): Promise<SalesSyncResult> => {
      const rawUrl = (salesUrl ?? connectedSalesUrl).trim();
      if (!rawUrl) {
        return { success: false, rows: 0, uniqueSimplified: 0, error: 'Please enter a Sales Google Sheet link.' };
      }

      const csvUrl = convertGoogleSheetUrlToCsv(rawUrl) || rawUrl;
      const forceRefresh = options?.forceRefresh ?? false;

      try {
        setIsSyncingSales(true);
        setSalesSyncError(null);

        const endpoint = `/api/sales-summary?url=${encodeURIComponent(csvUrl)}${
          forceRefresh ? '&refresh=1' : ''
        }&_t=${Date.now()}`;
        const res = await fetch(endpoint, { cache: 'no-store' });

        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.error || `HTTP ${res.status} while syncing sales sheet.`);
        }

        const data: SalesSummaryData = await res.json();
        setSalesData(data);
        saveSalesSummaryToDb(data).catch(() => {});

        if (salesUrl && salesUrl.trim() !== connectedSalesUrl) {
          setConnectedSalesUrl(salesUrl.trim());
        }

        return {
          success: true,
          rows: data.totalRows,
          uniqueSimplified: data.uniqueSimplified,
        };
      } catch (err: any) {
        const msg = err?.message || 'Failed to sync sales Google Sheet.';
        setSalesSyncError(msg);
        return {
          success: false,
          rows: 0,
          uniqueSimplified: 0,
          error: msg,
        };
      } finally {
        setIsSyncingSales(false);
      }
    },
    [connectedSalesUrl, setConnectedSalesUrl]
  );

  // Direct Live Google Sheet CSV Sync (Stock Sheet)
  const syncFromLiveSheet = useCallback(
    async (sheetUrl?: string, options?: SyncOptions): Promise<SyncResult> => {
      const targetUrl = (sheetUrl ?? connectedSheetUrl).trim();
      if (!targetUrl) {
        return { success: false, count: 0, error: 'Please enter a Google Sheet link.' };
      }

      const preserveLocalEdits = options?.preserveLocalEdits ?? true;
      const silent = options?.silent ?? false;

      try {
        setIsSyncing(true);
        setSyncError(null);
        if (!silent) {
          setIsLoading(true);
          setLoadingMessage('Syncing live inventory from Google Sheet...');
        }

        const csvText = await fetchSheetCsvText(targetUrl);
        const parsed = parseStockCsv(csvText, 'Google Sheet Live Sync');

        if (parsed.length === 0) {
          throw new Error('No product rows found in the Google Sheet CSV.');
        }

        const existingItems = itemsRef.current;
        const isFirstFullLoad = existingItems.length <= 400;

        let finalItems: InventoryItem[];
        let changedCount = parsed.length;

        if (isFirstFullLoad) {
          const { merged } = mergeSheetItems(parsed, existingItems, preserveLocalEdits);
          finalItems = merged;
        } else {
          const res = mergeSheetItems(parsed, existingItems, preserveLocalEdits);
          finalItems = res.merged;
          changedCount = res.changedCount;
        }

        setItems(finalItems);
        await saveItemsToDb(finalItems);

        if (sheetUrl && sheetUrl.trim() !== connectedSheetUrl) {
          setConnectedSheetUrl(sheetUrl.trim());
        }

        const nowIso = new Date().toISOString();
        setLastSyncTime(nowIso);
        localStorage.setItem(LAST_SYNC_TIME_KEY, nowIso);

        return {
          success: true,
          count: finalItems.length,
          changedCount,
        };
      } catch (err: any) {
        const msg = err?.message || 'Failed to sync Google Sheet.';
        setSyncError(msg);
        return {
          success: false,
          count: 0,
          error: msg,
        };
      } finally {
        setIsSyncing(false);
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [connectedSheetUrl, setConnectedSheetUrl]
  );

  // Load stock + cached sales from IndexedDB on startup, then auto-sync both sheets in background
  useEffect(() => {
    let isMounted = true;

    async function initDbAndSync() {
      let loadedCount = 0;
      let hasCachedSales = false;

      try {
        setIsLoading(true);
        setLoadingMessage('Restoring inventory records from offline storage...');
        const [stored, cachedSales] = await Promise.all([
          loadItemsFromDb(),
          loadSalesSummaryFromDb(),
        ]);

        const hasFreshSchema = cachedSales?.schemaVersion === SALES_SUMMARY_SCHEMA_VERSION;
        if (isMounted && cachedSales && cachedSales.bySimplified && hasFreshSchema) {
          setSalesData(cachedSales);
          hasCachedSales = true;
        }

        if (isMounted && stored && stored.length > 0) {
          const { items: cleaned, hadDuplicates } = deduplicateItemIds(stored);
          setItems(cleaned);
          itemsRef.current = cleaned;
          loadedCount = cleaned.length;
          if (hadDuplicates) {
            saveItemsToDb(cleaned).catch(() => {});
          }
        } else {
          loadedCount = itemsRef.current.length;
        }
      } catch (err) {
        console.warn('Failed to load from IndexedDB, using seed data', err);
        loadedCount = itemsRef.current.length;
      } finally {
        if (isMounted) {
          isInitialLoad.current = false;
        }
      }

      const activeUrl = localStorage.getItem(SHEET_URL_STORAGE_KEY) || DEFAULT_PUBLISHED_SHEET_URL;
      const activeSalesUrl = localStorage.getItem(SALES_URL_STORAGE_KEY) || DEFAULT_SALES_SHEET_URL;

      const isOnlineNow = typeof navigator !== 'undefined' && navigator.onLine;
      const shouldAutoSyncStock =
        isOnlineNow && Boolean(activeUrl) && (autoSyncEnabled || loadedCount <= 400);
      const shouldAutoSyncSales =
        isOnlineNow && Boolean(activeSalesUrl) && (autoSyncEnabled || !hasCachedSales);

      // Start sales sync non-blocking in background so UI opens quickly
      if (shouldAutoSyncSales && isMounted) {
        syncSalesSheet(activeSalesUrl, { forceRefresh: !hasCachedSales }).catch(() => {});
      }

      if (shouldAutoSyncStock && isMounted) {
        const silent = loadedCount > 400;
        if (silent) {
          setIsLoading(false);
        }
        await syncFromLiveSheet(activeUrl, {
          preserveLocalEdits: true,
          silent,
        });
      }

      if (isMounted) {
        setIsLoading(false);
      }
    }

    initDbAndSync();

    return () => {
      isMounted = false;
    };
  }, []);

  // Persist items to IndexedDB whenever changed
  useEffect(() => {
    if (isInitialLoad.current) return;

    const timer = setTimeout(() => {
      saveItemsToDb(items).catch((err) => {
        console.error('Error auto-saving items to IndexedDB', err);
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [items]);

  // Fast sales lookup helpers keyed by normalized Simplified name
  const getItemSalesRecord = useCallback(
    (simplified: string): SalesRecord | null => {
      if (!salesData || !simplified) return null;
      return salesData.bySimplified[simplified.trim().toLowerCase()] || null;
    },
    [salesData]
  );

  const getItemSales = useCallback(
    (simplified: string, period?: SalesPeriod): number => {
      if (!salesData || !simplified) return 0;
      const rec = salesData.bySimplified[simplified.trim().toLowerCase()];
      return getSalesValueForRecord(rec, period ?? filters.salesPeriod);
    },
    [salesData, filters.salesPeriod]
  );

  // Extract unique categories, colors, and sizes (naturally sorted)
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.item && item.item.trim()) set.add(item.item.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [items]);

  const colors = useMemo(() => {
    const set = new Set<string>();
    const hasCategoryFilter = filters.category !== 'all';
    items.forEach((item) => {
      if (hasCategoryFilter && item.item !== filters.category) return;
      if (item.color && item.color.trim()) set.add(item.color.trim());
    });
    if (filters.color !== 'all') set.add(filters.color);
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [items, filters.category, filters.color]);

  const sizes = useMemo(() => {
    const set = new Set<string>();
    const hasCategoryFilter = filters.category !== 'all';
    items.forEach((item) => {
      if (hasCategoryFilter && item.item !== filters.category) return;
      if (item.size && item.size.trim()) set.add(item.size.trim());
    });
    if (filters.size !== 'all') set.add(filters.size);
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [items, filters.category, filters.size]);

  const modifiedCount = useMemo(() => {
    return items.filter((it) => it.locallyModified).length;
  }, [items]);

  // Helper to append history entry keeping max 5 updates
  const appendHistory = (
    currentHistory: StockHistoryEntry[] = [],
    entry: Omit<StockHistoryEntry, 'id' | 'timestamp'>
  ): StockHistoryEntry[] => {
    const newEntry: StockHistoryEntry = {
      ...entry,
      id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    return [newEntry, ...currentHistory].slice(0, 5);
  };

  // 1. Instant Stock update
  const updateStock = (id: string, newStock: number, note?: string) => {
    const validStock = Math.max(0, Math.floor(newStock));
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          if (item.stock === validStock) return item;
          const updatedHistory = appendHistory(item.history, {
            field: 'STOCK',
            oldValue: item.stock,
            newValue: validStock,
            changeNote:
              note ||
              (validStock > item.stock
                ? `Restocked +${validStock - item.stock}`
                : `Reduced -${item.stock - validStock}`),
          });
          return {
            ...item,
            stock: validStock,
            history: updatedHistory,
            updatedAt: new Date().toISOString(),
            locallyModified: true,
          };
        }
        return item;
      })
    );
  };

  // 2. Instant Simplified name update
  const updateSimplified = (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          if (item.simplified === trimmed) return item;
          const updatedHistory = appendHistory(item.history, {
            field: 'Simplified',
            oldValue: item.simplified,
            newValue: trimmed,
            changeNote: 'Name renamed in master record',
          });
          return {
            ...item,
            simplified: trimmed,
            history: updatedHistory,
            updatedAt: new Date().toISOString(),
            locallyModified: true,
          };
        }
        return item;
      })
    );
  };

  // 3. Quick Stock Delta (+/-)
  const quickAdjustStock = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextStock = Math.max(0, item.stock + delta);
          if (nextStock === item.stock) return item;
          const updatedHistory = appendHistory(item.history, {
            field: 'STOCK',
            oldValue: item.stock,
            newValue: nextStock,
            changeNote: delta > 0 ? `Quick added +${delta}` : `Quick reduced ${delta}`,
          });
          return {
            ...item,
            stock: nextStock,
            history: updatedHistory,
            updatedAt: new Date().toISOString(),
            locallyModified: true,
          };
        }
        return item;
      })
    );
  };

  // 4. Batch updates
  const batchUpdateStock = (updates: { id: string; stock: number; note?: string }[]) => {
    const updateMap = new Map(updates.map((u) => [u.id, u]));
    setItems((prev) =>
      prev.map((item) => {
        const u = updateMap.get(item.id);
        if (u && u.stock !== item.stock) {
          const validStock = Math.max(0, Math.floor(u.stock));
          const updatedHistory = appendHistory(item.history, {
            field: 'STOCK',
            oldValue: item.stock,
            newValue: validStock,
            changeNote: u.note || 'Bulk audit adjustment',
          });
          return {
            ...item,
            stock: validStock,
            history: updatedHistory,
            updatedAt: new Date().toISOString(),
            locallyModified: true,
          };
        }
        return item;
      })
    );
  };

  // 5. Update arbitrary field
  const updateItemField = (id: string, field: keyof InventoryItem, value: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            [field]: value,
            updatedAt: new Date().toISOString(),
            locallyModified: true,
          };
        }
        return item;
      })
    );
  };

  // 6. Reset to Default
  const resetToDefault = async () => {
    setIsLoading(true);
    setLoadingMessage('Resetting to default catalog...');
    const fresh = parseStockCsv(initialCsvRaw);
    setItems(fresh);
    await saveItemsToDb(fresh);
    setIsLoading(false);
  };

  // 7. Import CSV directly
  const importCsvData = (csvContent: string) => {
    try {
      setIsLoading(true);
      setLoadingMessage('Parsing and importing inventory records...');
      const parsed = parseStockCsv(csvContent, 'CSV File Import');
      if (parsed.length === 0) {
        setIsLoading(false);
        return { success: false, count: 0, error: 'No valid inventory rows found in provided CSV.' };
      }
      setItems(parsed);
      saveItemsToDb(parsed);
      const nowIso = new Date().toISOString();
      setLastSyncTime(nowIso);
      localStorage.setItem(LAST_SYNC_TIME_KEY, nowIso);
      setIsLoading(false);
      return { success: true, count: parsed.length };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, count: 0, error: err?.message || 'Failed to parse CSV file.' };
    }
  };

  // 8. Export CSV
  const exportCsv = () => {
    const csv = exportToCsv(items);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Stock_Master_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 9. Copy TSV to clipboard
  const copyTsvToClipboard = async (): Promise<boolean> => {
    try {
      const tsv = exportToTsv(items);
      await navigator.clipboard.writeText(tsv);
      return true;
    } catch (err) {
      console.error('Clipboard copy failed', err);
      return false;
    }
  };

  const copyModifiedTsvToClipboard = async (): Promise<boolean> => {
    try {
      const modified = items.filter((it) => it.locallyModified);
      if (modified.length === 0) return false;
      const tsv = exportToTsv(modified);
      await navigator.clipboard.writeText(tsv);
      return true;
    } catch (err) {
      console.error('Clipboard copy failed', err);
      return false;
    }
  };

  const clearModifiedFlags = () => {
    setItems((prev) => prev.map((it) => ({ ...it, locallyModified: false })));
  };

  // Global history aggregator
  const globalHistory = useMemo(() => {
    const list: (StockHistoryEntry & { sku: string; simplified: string; itemId: string })[] = [];
    items.forEach((item) => {
      (item.history || []).forEach((h) => {
        list.push({
          ...h,
          sku: item.sku,
          simplified: item.simplified,
          itemId: item.id,
        });
      });
    });
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 60);
  }, [items]);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    const searchLower = filters.search.trim().toLowerCase();
    const threshold = filters.lowStockThreshold;
    const period = filters.salesPeriod;

    return items
      .filter((item) => {
        if (filters.status === 'out_of_stock' && item.stock !== 0) return false;
        if (filters.status === 'low_stock' && (item.stock === 0 || item.stock > threshold)) return false;
        if (filters.status === 'in_stock' && item.stock <= threshold) return false;
        if (filters.status === 'reorder' && item.stock > threshold) return false;

        if (filters.category !== 'all' && item.item !== filters.category) return false;
        if (filters.color !== 'all' && (item.color || '').trim() !== filters.color) return false;
        if (filters.size !== 'all' && (item.size || '').trim() !== filters.size) return false;

        if (filters.salesActivity === 'with_sales') {
          if (getItemSales(item.simplified, period) <= 0) return false;
        } else if (filters.salesActivity === 'no_sales') {
          if (getItemSales(item.simplified, period) > 0) return false;
        }

        if (searchLower) {
          const matchSku = item.sku.toLowerCase().includes(searchLower);
          const matchName = item.simplified.toLowerCase().includes(searchLower);
          const matchCategory = item.item.toLowerCase().includes(searchLower);
          const matchAsin = item.asin.toLowerCase().includes(searchLower);
          const matchEan = item.ean.toLowerCase().includes(searchLower);
          const matchColor = item.color.toLowerCase().includes(searchLower);
          const matchSize = item.size.toLowerCase().includes(searchLower);
          return matchSku || matchName || matchCategory || matchAsin || matchEan || matchColor || matchSize;
        }

        return true;
      })
      .sort((a, b) => {
        if (filters.sortBy === 'stock-asc') return a.stock - b.stock;
        if (filters.sortBy === 'stock-desc') return b.stock - a.stock;
        if (filters.sortBy === 'mrp-desc') return b.mrp - a.mrp;
        if (filters.sortBy === 'simplified') return a.simplified.localeCompare(b.simplified);
        if (filters.sortBy === 'sku') return a.sku.localeCompare(b.sku);
        if (filters.sortBy === 'sales-desc') {
          return getItemSales(b.simplified, period) - getItemSales(a.simplified, period);
        }
        if (filters.sortBy === 'sales-asc') {
          return getItemSales(a.simplified, period) - getItemSales(b.simplified, period);
        }
        if (filters.sortBy === 'updated') {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }
        return 0;
      });
  }, [items, filters, getItemSales]);

  // Statistics (including unique-simplified period sales total across filtered items)
  const stats = useMemo(() => {
    let totalUnits = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;
    let healthyCount = 0;
    let inventoryValue = 0;

    const threshold = filters.lowStockThreshold;

    items.forEach((it) => {
      totalUnits += it.stock;
      inventoryValue += it.stock * (it.mrp || 0);

      if (it.stock === 0) {
        outOfStockCount++;
      } else if (it.stock <= threshold) {
        lowStockCount++;
      } else {
        healthyCount++;
      }
    });

    // Sum period sales per unique Simplified name in filtered items to avoid double-counting duplicate SKUs
    const seenSimplified = new Set<string>();
    let filteredSalesTotal = 0;
    filteredItems.forEach((it) => {
      const k = it.simplified.trim().toLowerCase();
      if (k && !seenSimplified.has(k)) {
        seenSimplified.add(k);
        filteredSalesTotal += getItemSales(it.simplified, filters.salesPeriod);
      }
    });

    return {
      totalSkus: items.length,
      totalUnits,
      outOfStockCount,
      lowStockCount,
      healthyCount,
      inventoryValue,
      reorderCount: outOfStockCount + lowStockCount,
      filteredSalesTotal,
    };
  }, [items, filteredItems, filters.lowStockThreshold, filters.salesPeriod, getItemSales]);

  return (
    <InventoryContext.Provider
      value={{
        items,
        filteredItems,
        filters,
        setFilters,
        updateStock,
        updateSimplified,
        updateItemField,
        quickAdjustStock,
        batchUpdateStock,
        importCsvData,
        syncFromLiveSheet,
        connectedSheetUrl,
        setConnectedSheetUrl,
        salesData,
        connectedSalesUrl,
        setConnectedSalesUrl,
        isSyncingSales,
        salesSyncError,
        syncSalesSheet,
        getItemSales,
        getItemSalesRecord,
        autoSyncEnabled,
        setAutoSyncEnabled,
        isSyncing,
        syncError,
        modifiedCount,
        copyModifiedTsvToClipboard,
        clearModifiedFlags,
        resetToDefault,
        exportCsv,
        copyTsvToClipboard,
        isOnline,
        isLoading,
        loadingMessage,
        lastSyncTime,
        globalHistory,
        categories,
        colors,
        sizes,
        stats,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
