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
  X,
  FileSpreadsheet,
  Calculator,
  Sun,
  Moon,
} from 'lucide-react';

interface NavbarProps {
  viewMode: 'grid' | 'table';
  setViewMode: (mode: 'grid' | 'table') => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSync: () => void;
  onOpenReorder: () => void;
  onOpenAudit: () => void;
  onOpenHistory: () => void;
  onOpenConsumption: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  viewMode,
  setViewMode,
  theme,
  onToggleTheme,
  onOpenSync,
  onOpenReorder,
  onOpenAudit,
  onOpenHistory,
  onOpenConsumption,
}) => {
  const {
    filters,
    setFilters,
    isOnline,
    isSyncing,
    isSyncingSales,
    syncFromLiveSheet,
    syncSalesSheet,
    modifiedCount,
    stats,
  } = useInventory();

  const handleRefreshAll = () => {
    syncFromLiveSheet();
    syncSalesSheet(undefined, { forceRefresh: true });
  };

  return (
    <header className="sticky top-0 z-30 bg-[var(--header-bg)] text-[var(--header-text)] border-b border-[var(--header-border)]">
      <div className="w-full mx-auto px-4 sm:px-6 py-2.5">
        <div className="flex items-center justify-between gap-3">
          {/* Brand Logo & Live Sync Status */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center">
              <Boxes className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-[15px] text-white tracking-tight whitespace-nowrap">
                  StockSync
                </span>
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-white/10 text-white/90 border border-white/15 whitespace-nowrap">
                  Live Sheet
                </span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-white/75 mt-0.5 whitespace-nowrap">
                <span className="flex items-center gap-1.5">
                  {isOnline ? (
                    <span className="flex items-center gap-1.5 text-white/90 font-normal">
                      <span className="w-2 h-2 rounded-full bg-white/80" />
                      {isSyncing || isSyncingSales ? 'Syncing...' : 'Live Sync'}
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
          <div className="flex-1 min-w-[180px] max-w-md relative hidden md:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
              placeholder="Search SKU, article name, ASIN, EAN, color..."
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
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-2 py-1 rounded-[6px] text-[12px] flex items-center gap-1.5 transition-colors duration-150 border whitespace-nowrap ${
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
                <span className="hidden xl:inline">Cards</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-2 py-1 rounded-[6px] text-[12px] flex items-center gap-1.5 transition-colors duration-150 border whitespace-nowrap ${
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
                <span className="hidden xl:inline">Sheet Table</span>
              </button>
            </div>

            {/* Quick Cycle Count / Audit Mode Button */}
            <button
              onClick={onOpenAudit}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[12px] font-medium flex items-center gap-1.5 transition-colors duration-150 whitespace-nowrap"
              title="Fast cycle count / barcode audit"
            >
              <QrCode className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="hidden xl:inline">Audit Mode</span>
            </button>

            {/* History Button */}
            <button
              onClick={onOpenHistory}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[12px] font-medium flex items-center gap-1.5 transition-colors duration-150 whitespace-nowrap"
              title="View history logs"
            >
              <History className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="hidden xl:inline">History Log</span>
            </button>

            {/* Quick Refresh from Live Sheets */}
            <button
              onClick={handleRefreshAll}
              disabled={isSyncing || isSyncingSales || !isOnline}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[12px] font-medium flex items-center gap-1.5 transition-colors duration-150 disabled:opacity-50 whitespace-nowrap"
              title="Refresh stock and sales Google Sheets now"
            >
              <RefreshCw
                className={`w-4 h-4 text-[var(--text-muted)] ${
                  isSyncing || isSyncingSales ? 'animate-spin' : ''
                }`}
              />
              <span className="hidden xl:inline">
                {isSyncing || isSyncingSales ? 'Syncing' : 'Refresh'}
              </span>
            </button>

            {/* Consumption & Re-Order Calculator Button */}
            <button
              onClick={onOpenConsumption}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[12px] font-medium flex items-center gap-1.5 transition-colors duration-150 whitespace-nowrap"
              title="Sales consumption & re-order formula calculator"
            >
              <Calculator className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="hidden lg:inline">Sales Calc</span>
            </button>

            {/* Google Sheet Link & Export Modal Button */}
            <button
              onClick={onOpenSync}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[12px] font-medium flex items-center gap-1.5 transition-colors duration-150 whitespace-nowrap"
              title="Direct sheet links & export"
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

            {/* Dark / Light Theme Toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[12px] font-medium flex items-center gap-1.5 transition-colors duration-150 whitespace-nowrap"
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-[var(--accent)]" />
              ) : (
                <Moon className="w-4 h-4 text-[var(--text-muted)]" />
              )}
              <span className="hidden 2xl:inline">
                {theme === 'dark' ? 'Light' : 'Dark'}
              </span>
            </button>

            {/* Primary Action: Re-Order Button (ONLY primary amber button) */}
            <button
              onClick={onOpenReorder}
              className="px-3 py-1.5 rounded-lg bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-white text-[12px] font-medium flex items-center gap-1.5 transition-colors duration-150 whitespace-nowrap"
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
      </div>
    </header>
  );
};
