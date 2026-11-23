import React from 'react';
import { useInventory } from '../context/InventoryContext';
import {
  Boxes,
  Search,
  WifiOff,
  RefreshCw,
  History,
  ShoppingCart,
  QrCode,
  LayoutGrid,
  Table as TableIcon,
  SlidersHorizontal,
  X,
  FileSpreadsheet,
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
    isSyncing,
    syncFromLiveSheet,
    modifiedCount,
    stats,
    categories,
    colors,
  } = useInventory();

  return (
    <header className="sticky top-0 z-30 bg-[var(--header-bg)] text-[var(--header-text)] border-b border-black/15">
      {/* Top Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Brand Logo & Live Sync Status */}
          <div className="flex items-center gap-3 min-w-max">
            <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center">
              <Boxes className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-[15px] text-white tracking-tight">StockSync</span>
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-white/10 text-white/90 border border-white/15">
                  Live Sheet
                </span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-white/75 mt-0.5">
                <span className="flex items-center gap-1.5">
                  {isOnline ? (
                    <span className="flex items-center gap-1.5 text-white/90 font-normal">
                      <span className="w-2 h-2 rounded-full bg-white/80" />
                      {isSyncing ? 'Syncing...' : 'Live Sync'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-white/80 font-normal">
                      <WifiOff className="w-3 h-3 text-white/75" />
                      Offline mode
                    </span>
                  )}
                </span>
                <span className="hidden sm:inline text-white/35">•</span>
                <span className="hidden sm:inline text-white/75 font-normal">
                  {stats.totalSkus.toLocaleString()} products
                </span>
              </div>
            </div>
          </div>

          {/* Quick Search Input */}
          <div className="flex-1 max-w-md relative hidden md:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
              placeholder="Search by SKU, article name, ASIN, EAN, color, size..."
              className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-lg pl-9 pr-8 py-1.5 text-[13px] font-normal text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors duration-150"
            />
            {filters.search && (
              <button
                onClick={() => setFilters((p) => ({ ...p, search: '' }))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-150"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Actions & Tools */}
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1 rounded-[6px] text-[12px] flex items-center gap-1.5 transition-colors duration-150 border ${
                  viewMode === 'grid'
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)] font-medium'
                    : 'bg-transparent text-[var(--text-primary)] border-transparent hover:bg-[var(--table-hover)] font-normal'
                }`}
                title="Grid / Card view"
              >
                <LayoutGrid
                  className={`w-3.5 h-3.5 ${
                    viewMode === 'grid' ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                  }`}
                />
                <span className="hidden lg:inline">Cards</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 rounded-[6px] text-[12px] flex items-center gap-1.5 transition-colors duration-150 border ${
                  viewMode === 'table'
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)] font-medium'
                    : 'bg-transparent text-[var(--text-primary)] border-transparent hover:bg-[var(--table-hover)] font-normal'
                }`}
                title="Spreadsheet table view"
              >
                <TableIcon
                  className={`w-3.5 h-3.5 ${
                    viewMode === 'table' ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                  }`}
                />
                <span className="hidden lg:inline">Sheet Table</span>
              </button>
            </div>

            {/* Quick Cycle Count / Audit Mode Button */}
            <button
              onClick={onOpenAudit}
              className="px-3 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[13px] font-medium flex items-center gap-1.5 transition-colors duration-150"
              title="Fast cycle count / barcode audit"
            >
              <QrCode className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="hidden sm:inline">Audit Mode</span>
            </button>

            {/* History Button */}
            <button
              onClick={onOpenHistory}
              className="px-3 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[13px] font-medium flex items-center gap-1.5 transition-colors duration-150"
              title="View history logs"
            >
              <History className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="hidden sm:inline">History Log</span>
            </button>

            {/* Quick Refresh from Live Sheet */}
            <button
              onClick={() => syncFromLiveSheet()}
              disabled={isSyncing || !isOnline}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[13px] font-medium flex items-center gap-1.5 transition-colors duration-150 disabled:opacity-50"
              title="Refresh live Google Sheet now"
            >
              <RefreshCw
                className={`w-4 h-4 text-[var(--text-muted)] ${isSyncing ? 'animate-spin' : ''}`}
              />
              <span className="hidden lg:inline">{isSyncing ? 'Syncing' : 'Refresh'}</span>
            </button>

            {/* Google Sheet Link & Export Modal Button */}
            <button
              onClick={onOpenSync}
              className="px-3 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[13px] font-medium flex items-center gap-1.5 transition-colors duration-150"
              title="Direct sheet link & export"
            >
              <FileSpreadsheet className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="hidden sm:inline">Sheet Sync</span>
              {modifiedCount > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded bg-[var(--surface-subtle)] border border-[var(--border)] text-[var(--text-primary)] text-[11px] font-medium leading-none"
                  title={`${modifiedCount} local edits`}
                >
                  {modifiedCount}
                </span>
              )}
            </button>

            {/* Primary Action: Re-Order Button (ONLY primary amber button) */}
            <button
              onClick={onOpenReorder}
              className="px-3.5 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[13px] font-medium flex items-center gap-1.5 transition-colors duration-150"
              title="Re-order management"
            >
              <ShoppingCart className="w-4 h-4 text-white" />
              <span className="hidden sm:inline">Re-Order</span>
              {stats.reorderCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-white/20 text-white text-[11px] font-medium leading-none">
                  {stats.reorderCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="mt-2.5 relative md:hidden">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
            placeholder="Search SKU, article name, color, size, ASIN..."
            className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-lg pl-9 pr-8 py-1.5 text-[13px] font-normal text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
          />
          {filters.search && (
            <button
              onClick={() => setFilters((p) => ({ ...p, search: '' }))}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Strip: Categories, Colors & Sorting */}
        <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-white/15 overflow-x-auto no-scrollbar text-[12px]">
          <div className="flex items-center gap-1.5 text-white/75 text-[12px] font-normal shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-white/70" />
            <span>Filter:</span>
          </div>

          {/* Category Dropdown */}
          <select
            value={filters.category}
            onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}
            className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[12px] font-normal text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] shrink-0"
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
            className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[12px] font-normal text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] shrink-0"
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
            className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[12px] font-normal text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] shrink-0"
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
                  className={`px-2.5 py-1.5 rounded-lg text-[12px] border transition-colors duration-150 ${
                    active
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)] font-medium'
                      : 'bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--table-hover)] font-normal'
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
