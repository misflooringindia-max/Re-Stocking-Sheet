export interface StockHistoryEntry {
  id: string;
  timestamp: string; // ISO string
  field: 'STOCK' | 'Simplified' | 'MRP' | 'RESTOCK' | 'SYNC';
  oldValue: string | number;
  newValue: string | number;
  changeNote?: string;
}

export interface InventoryItem {
  id: string;
  sku: string; // Uniware SKU
  simplified: string; // Simplified Name (Editable)
  item: string; // Item Category (e.g. 3D Mat, Carpet, Towel)
  color: string;
  size: string;
  stock: number; // Stock Quantity (Editable)
  imageCol: string; // Original IMAGE column value
  ean: string;
  asin: string;
  mrp: number;
  imageLink: string;
  resolvedImageUrl: string;
  history: StockHistoryEntry[]; // Past 3 to 5 updates
  updatedAt: string;
  locallyModified?: boolean;
}

export type StockStatus = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'reorder';

export type SalesPeriod = '1m' | '3m' | '6m' | '12m' | 'all' | `month:${string}`;

export interface SalesRecord {
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

export interface SalesSummaryData {
  bySimplified: Record<string, SalesRecord>;
  totalRows: number;
  totalUnits: number;
  uniqueSimplified: number;
  minDate: string;
  maxDate: string;
  availableMonths: string[];
  syncedAt: string;
}

export interface FilterOptions {
  search: string;
  category: string;
  color: string;
  status: StockStatus;
  sortBy:
    | 'sku'
    | 'simplified'
    | 'stock-asc'
    | 'stock-desc'
    | 'mrp-desc'
    | 'updated'
    | 'sales-desc'
    | 'sales-asc';
  lowStockThreshold: number;
  salesPeriod: SalesPeriod;
  salesActivity: 'all' | 'with_sales' | 'no_sales';
}
