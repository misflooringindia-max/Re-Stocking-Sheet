export interface StockHistoryEntry {
  id: string;
  timestamp: string; // ISO string
  field: 'STOCK' | 'Simplified' | 'MRP' | 'RESTOCK';
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
}

export type StockStatus = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'reorder';

export interface FilterOptions {
  search: string;
  category: string;
  color: string;
  status: StockStatus;
  sortBy: 'sku' | 'simplified' | 'stock-asc' | 'stock-desc' | 'mrp-desc' | 'updated';
  lowStockThreshold: number;
}
