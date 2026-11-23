import React from 'react';
import { useInventory } from '../context/InventoryContext';
import {
  Boxes,
  Search,
  Wifi,
  WifiOff,
  Download,
  History,
  ShoppingCart,
  QrCode,
  LayoutGrid,
  Table as TableIcon,
  SlidersHorizontal,
  X,
} from 'lucide-react';

interface NavbarProps {
  viewMode: 'grid' | 'table';
  setViewMode: (mode: 'grid' | 'table') => void;
  onOpenSync: () => void;
  onOpenReorder: () => void;
  onOpenAudit: () => void;
  onOpenHistory: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  viewMode,
  setViewMode,
  onOpenSync,
  onOpenReorder,
  onOpenAudit,
  onOpenHistory,
}) => {
  const {
    filters,
    setFilters,
    isOnline,
    stats,
    categories,
    colors,
  } = useInventory();

  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-sm">
      {/* Top Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5">
        <div className="flex items-center justify-between gap-3">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2.5 min-w-max">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20 ring-1 ring-white/10">
              <Boxes className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white">StockSync</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Google Sheet Pro
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  {isOnline ? (
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Live Sync
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-400 font-semibold">
                      <WifiOff className="w-3 h-3 text-amber-400" />
                      Offline Mode
                    </span>
                  )}
                </span>
                <span className="hidden sm:inline text-slate-600">•</span>
                <span className="hidden sm:inline text-slate-300 font-medium">
                  {stats.totalSkus} Total Products
                </span>
              </div>
            </div>
          </div>

          {/* Quick Search Input */}
          <div className="flex-1 max-w-md relative hidden md:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
              placeholder="Search by SKU, Article Name, ASIN, EAN, Color, Size..."
              className="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-white placeholder-slate-400 focus:bg-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-xs"
            />
            {filters.search && (
              <button
                onClick={() => setFilters((p) => ({ ...p, search: '' }))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Actions & Tools */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === 'grid'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Grid / Card View"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden lg:inline text-[11px]">Cards</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === 'table'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Spreadsheet Table View"
              >
                <TableIcon className="w-4 h-4" />
                <span className="hidden lg:inline text-[11px]">Sheet Table</span>
              </button>
            </div>

            {/* Quick Cycle Count / Audit Mode Button */}
            <button
              onClick={onOpenAudit}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
              title="Fast Cycle Count / Barcode Audit"
            >
              <QrCode className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Audit Mode</span>
            </button>

            {/* History Button */}
            <button
              onClick={onOpenHistory}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
              title="View History Logs"
            >
              <History className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">History Log</span>
            </button>

            {/* Reorder Button */}
            <button
              onClick={onOpenReorder}
              className="relative px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
              title="Re-Order Management"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Re-Order</span>
              {stats.reorderCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-white text-amber-900 text-[10px] font-black shadow-xs">
                  {stats.reorderCount}
                </span>
              )}
            </button>

            {/* Google Sheet Sync / Export Button */}
            <button
              onClick={onOpenSync}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shadow-indigo-600/30"
              title="Sync & Export to Google Sheet"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sheet Sync</span>
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="mt-2 relative md:hidden">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
            placeholder="Search SKU, article name, color, size, ASIN..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
          {filters.search && (
            <button
              onClick={() => setFilters((p) => ({ ...p, search: '' }))}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Strip: Categories, Colors & Sorting */}
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800 overflow-x-auto no-scrollbar text-xs">
          <div className="flex items-center gap-1 text-slate-400 text-[11px] font-bold shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span>Filter:</span>
          </div>

          {/* Category Dropdown */}
          <select
            value={filters.category}
            onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus:border-indigo-500 shrink-0"
          >
            <option value="all">All Articles ({categories.length})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Color Dropdown */}
          <select
            value={filters.color}
            onChange={(e) => setFilters((p) => ({ ...p, color: e.target.value }))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus:border-indigo-500 shrink-0"
          >
            <option value="all">All Colors ({colors.length})</option>
            {colors.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Sort By Dropdown */}
          <select
            value={filters.sortBy}
            onChange={(e) => setFilters((p) => ({ ...p, sortBy: e.target.value as any }))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus:border-indigo-500 shrink-0"
          >
            <option value="stock-asc">Stock: Low to High (Alerts first)</option>
            <option value="stock-desc">Stock: High to Low</option>
            <option value="simplified">Name (A - Z)</option>
            <option value="sku">SKU Code</option>
            <option value="mrp-desc">Price / MRP: High to Low</option>
            <option value="updated">Recently Updated</option>
          </select>

          {/* Status Chips */}
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            {(['all', 'out_of_stock', 'low_stock', 'in_stock'] as const).map((st) => {
              const active = filters.status === st;
              const labels = {
                all: 'All',
                out_of_stock: '0 Out of Stock',
                low_stock: 'Low Stock',
                in_stock: 'In Stock',
              };
              return (
                <button
                  key={st}
                  onClick={() => setFilters((p) => ({ ...p, status: st }))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    active
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {labels[st]}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};
