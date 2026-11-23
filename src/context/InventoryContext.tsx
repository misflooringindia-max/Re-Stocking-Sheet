import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { InventoryItem, StockHistoryEntry, StockStatus, FilterOptions } from '../types/inventory';
import { parseStockCsv, exportToCsv, exportToTsv, convertGoogleSheetUrlToCsv } from '../utils/csvHelper';
import { saveItemsToDb, loadItemsFromDb, clearDb } from '../utils/db';
import { initAuth, googleSignIn, logoutGoogle, getAccessToken, getCurrentUser } from '../services/googleAuth';
import {
  extractSpreadsheetId,
  extractGid,
  fetchSpreadsheetValues,
  updateSpreadsheetFromInventory,
  fetchSpreadsheetMetadata,
  SheetTabInfo
} from '../services/googleSheets';
import { User } from 'firebase/auth';
import initialCsvRaw from '../data/initialData.csv?raw';

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
  importFromGoogleSheetUrl: (sheetUrl: string) => Promise<{ success: boolean; count: number; error?: string }>;
  connectAndSyncWithGoogleAccount: (sheetUrlOrId: string, specificTabTitle?: string) => Promise<{ success: boolean; count: number; error?: string }>;
  pushChangesToGoogleSheet: () => Promise<{ success: boolean; count: number; error?: string }>;
  googleUser: User | null;
  googleToken: string | null;
  handleGoogleLogin: () => Promise<boolean>;
  handleGoogleLogout: () => Promise<void>;
  connectedSheetId: string | null;
  connectedSheetTitle: string | null;
  availableTabs: SheetTabInfo[];
  selectedTab: string | null;
  setSelectedTab: (tab: string) => void;
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
  stats: {
    totalSkus: number;
    totalUnits: number;
    outOfStockCount: number;
    lowStockCount: number;
    healthyCount: number;
    inventoryValue: number;
    reorderCount: number;
  };
}

const DEFAULT_THRESHOLD = 15;

const InventoryContext = createContext<InventoryContextType | null>(null);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<InventoryItem[]>(() => {
    return parseStockCsv(initialCsvRaw);
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<string>('Loading database...');
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toISOString());

  // Google Workspace Auth State
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [connectedSheetId, setConnectedSheetId] = useState<string | null>(() => {
    return localStorage.getItem('stocksync_connected_sheet_id') || null;
  });
  const [connectedSheetTitle, setConnectedSheetTitle] = useState<string | null>(() => {
    return localStorage.getItem('stocksync_connected_sheet_title') || null;
  });
  const [availableTabs, setAvailableTabs] = useState<SheetTabInfo[]>([]);
  const [selectedTab, setSelectedTab] = useState<string | null>(() => {
    return localStorage.getItem('stocksync_selected_tab') || null;
  });

  const isInitialLoad = useRef(true);

  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    category: 'all',
    color: 'all',
    status: 'all',
    sortBy: 'stock-asc',
    lowStockThreshold: DEFAULT_THRESHOLD,
  });

  // Init Google Auth listener
  useEffect(() => {
    const unsub = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => unsub();
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

  // Load from IndexedDB on startup
  useEffect(() => {
    let isMounted = true;

    async function initDb() {
      try {
        setIsLoading(true);
        setLoadingMessage('Restoring inventory records from offline storage...');
        const stored = await loadItemsFromDb();
        if (isMounted && stored && stored.length > 0) {
          setItems(stored);
        }
      } catch (err) {
        console.warn('Failed to load from IndexedDB, using seed data', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
          isInitialLoad.current = false;
        }
      }
    }

    initDb();

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
      setLastSyncTime(new Date().toISOString());
    }, 400);

    return () => clearTimeout(timer);
  }, [items]);

  // Google Sign In handler
  const handleGoogleLogin = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setLoadingMessage('Signing in with Google Account...');
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Sign in error', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logoutGoogle();
    setGoogleUser(null);
    setGoogleToken(null);
  };

  // Extract unique categories and colors
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.item && item.item.trim()) set.add(item.item.trim());
    });
    return Array.from(set).sort();
  }, [items]);

  const colors = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.color && item.color.trim()) set.add(item.color.trim());
    });
    return Array.from(set).sort();
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
            changeNote: note || (validStock > item.stock ? `Restocked +${validStock - item.stock}` : `Reduced -${item.stock - validStock}`),
          });
          return {
            ...item,
            stock: validStock,
            history: updatedHistory,
            updatedAt: new Date().toISOString(),
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
      const parsed = parseStockCsv(csvContent);
      if (parsed.length === 0) {
        setIsLoading(false);
        return { success: false, count: 0, error: 'No valid inventory rows found in provided CSV.' };
      }
      setItems(parsed);
      saveItemsToDb(parsed);
      setIsLoading(false);
      return { success: true, count: parsed.length };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, count: 0, error: err?.message || 'Failed to parse CSV file.' };
    }
  };

  // 8. Connect and sync directly via Google Workspace OAuth API
  const connectAndSyncWithGoogleAccount = async (
    sheetUrlOrId: string,
    specificTabTitle?: string
  ): Promise<{ success: boolean; count: number; error?: string }> => {
    try {
      const sheetId = extractSpreadsheetId(sheetUrlOrId);
      if (!sheetId) {
        return { success: false, count: 0, error: 'Invalid Google Sheet link or ID. Please check the URL.' };
      }

      const gid = extractGid(sheetUrlOrId);

      let currentToken = await getAccessToken();
      if (!currentToken) {
        setIsLoading(true);
        setLoadingMessage('Authorizing Google Sheets API...');
        try {
          const authResult = await googleSignIn();
          if (authResult?.accessToken) {
            currentToken = authResult.accessToken;
            setGoogleUser(authResult.user);
            setGoogleToken(authResult.accessToken);
          }
        } catch (authErr: any) {
          console.warn('Google sign-in cancelled or failed, attempting direct access:', authErr);
        }
      }

      setIsLoading(true);
      setLoadingMessage(`Connecting to Google Sheet...`);

      const tabToUse = specificTabTitle || selectedTab || undefined;
      const res = await fetchSpreadsheetValues(sheetId, tabToUse, gid || undefined);

      if (res.items.length === 0) {
        setIsLoading(false);
        return { success: false, count: 0, error: 'No product rows found in Google Sheet.' };
      }

      setItems(res.items);
      await saveItemsToDb(res.items);

      setConnectedSheetId(sheetId);
      localStorage.setItem('stocksync_connected_sheet_id', sheetId);

      if (res.metadata) {
        setConnectedSheetTitle(res.metadata.title);
        localStorage.setItem('stocksync_connected_sheet_title', res.metadata.title);
        setAvailableTabs(res.metadata.sheets);
        setSelectedTab(res.usedTab);
        localStorage.setItem('stocksync_selected_tab', res.usedTab);
      } else {
        setSelectedTab(res.usedTab);
      }

      setIsLoading(false);
      return { success: true, count: res.items.length };
    } catch (err: any) {
      setIsLoading(false);
      return {
        success: false,
        count: 0,
        error: err?.message || 'Failed to connect to Google Sheet. Check permissions.',
      };
    }
  };

  // 9. Push modifications back to connected Google Sheet with explicit confirmation
  const pushChangesToGoogleSheet = async (): Promise<{ success: boolean; count: number; error?: string }> => {
    if (!connectedSheetId) {
      return { success: false, count: 0, error: 'No Google Sheet connected. Connect a sheet first.' };
    }

    try {
      setIsLoading(true);
      setLoadingMessage('Writing updated inventory records back to Google Sheet...');
      const targetTab = selectedTab || connectedSheetTitle || undefined;
      const res = await updateSpreadsheetFromInventory(connectedSheetId, items, targetTab);
      setIsLoading(false);
      return { success: true, count: res.updatedRows };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, count: 0, error: err?.message || 'Failed to write back to Google Sheet.' };
    }
  };

  // 10. Direct URL sync fallback (for published web CSV links)
  const importFromGoogleSheetUrl = async (sheetUrl: string): Promise<{ success: boolean; count: number; error?: string }> => {
    // If it's a standard Google Docs link, prefer OAuth connect for 100% reliable access
    const sheetId = extractSpreadsheetId(sheetUrl);
    if (sheetId) {
      return connectAndSyncWithGoogleAccount(sheetId);
    }

    try {
      setIsLoading(true);
      setLoadingMessage('Fetching CSV from web...');

      let fetchUrl = sheetUrl.trim();
      const directCsvUrl = convertGoogleSheetUrlToCsv(fetchUrl);
      if (directCsvUrl) {
        fetchUrl = directCsvUrl;
      }

      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(fetchUrl)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();

      const parsed = parseStockCsv(text);
      if (parsed.length === 0) {
        setIsLoading(false);
        return { success: false, count: 0, error: 'Could not parse products from sheet URL.' };
      }

      setItems(parsed);
      await saveItemsToDb(parsed);
      setIsLoading(false);
      return { success: true, count: parsed.length };
    } catch (err: any) {
      setIsLoading(false);
      return {
        success: false,
        count: 0,
        error: `Could not fetch: ${err?.message || 'Try connecting with Google Account or uploading CSV file directly'}`
      };
    }
  };

  // 11. Export CSV
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

  // 12. Copy TSV to clipboard
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

  // Statistics
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

    return {
      totalSkus: items.length,
      totalUnits,
      outOfStockCount,
      lowStockCount,
      healthyCount,
      inventoryValue,
      reorderCount: outOfStockCount + lowStockCount,
    };
  }, [items, filters.lowStockThreshold]);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    const searchLower = filters.search.trim().toLowerCase();
    const threshold = filters.lowStockThreshold;

    return items
      .filter((item) => {
        if (filters.status === 'out_of_stock' && item.stock !== 0) return false;
        if (filters.status === 'low_stock' && (item.stock === 0 || item.stock > threshold)) return false;
        if (filters.status === 'in_stock' && item.stock <= threshold) return false;
        if (filters.status === 'reorder' && item.stock > threshold) return false;

        if (filters.category !== 'all' && item.item !== filters.category) return false;
        if (filters.color !== 'all' && item.color !== filters.color) return false;

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
        if (filters.sortBy === 'updated') {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }
        return 0;
      });
  }, [items, filters]);

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
        importFromGoogleSheetUrl,
        connectAndSyncWithGoogleAccount,
        pushChangesToGoogleSheet,
        googleUser,
        googleToken,
        handleGoogleLogin,
        handleGoogleLogout,
        connectedSheetId,
        connectedSheetTitle,
        availableTabs,
        selectedTab,
        setSelectedTab,
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
