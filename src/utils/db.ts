/**
 * IndexedDB storage layer for large inventory datasets (3,500+ to 50,000+ items)
 * Overcomes localStorage's 5MB quota limit.
 */
import { InventoryItem, SalesSummaryData } from '../types/inventory';

const DB_NAME = 'StockSyncDB';
const DB_VERSION = 1;
const STORE_NAME = 'inventory_items';
const META_STORE = 'app_metadata';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveItemsToDb(items: InventoryItem[]): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const meta = tx.objectStore(META_STORE);

    // Clear existing
    store.clear();

    // Insert all items
    for (const item of items) {
      store.put(item);
    }

    meta.put({ key: 'lastSync', value: new Date().toISOString() });
    meta.put({ key: 'totalCount', value: items.length });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB save failed, falling back to localStorage if size permits', err);
    try {
      // Only keep lightweight data if falling back to localStorage
      localStorage.setItem('stocksync_inventory_backup', JSON.stringify(items.slice(0, 500)));
    } catch {
      // ignore
    }
  }
}

export async function loadItemsFromDb(): Promise<InventoryItem[] | null> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const result = request.result;
        if (Array.isArray(result) && result.length > 0) {
          resolve(result);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('IndexedDB load failed', err);
    return null;
  }
}

export async function saveSalesSummaryToDb(summary: SalesSummaryData): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(META_STORE, 'readwrite');
    const meta = tx.objectStore(META_STORE);
    meta.put({ key: 'sales_summary', value: summary });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to save sales summary to IndexedDB', err);
  }
}

export async function loadSalesSummaryFromDb(): Promise<SalesSummaryData | null> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(META_STORE, 'readonly');
    const meta = tx.objectStore(META_STORE);
    const request = meta.get('sales_summary');

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const row = request.result;
        resolve(row?.value ?? null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to load sales summary from IndexedDB', err);
    return null;
  }
}

export async function clearDb(): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
  tx.objectStore(STORE_NAME).clear();
  tx.objectStore(META_STORE).clear();
}
