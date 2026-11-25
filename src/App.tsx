import React, { useState, useEffect, useMemo } from 'react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { Navbar } from './components/Navbar';
import { FilterSidebar } from './components/FilterSidebar';
import { StatsCards } from './components/StatsCards';
import { ImportSheetBanner } from './components/ImportSheetBanner';
import { ItemCard } from './components/ItemCard';
import { ItemTable } from './components/ItemTable';
import { ItemDetailModal } from './components/ItemDetailModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { ReorderModal } from './components/ReorderModal';
import { SyncModal } from './components/SyncModal';
import { AuditModeModal } from './components/AuditModeModal';
import { ConsumptionCalculatorModal } from './components/ConsumptionCalculatorModal';
import { InventoryItem } from './types/inventory';
import { formatSalesPeriodLabel } from './utils/csvHelper';
import {
  PackageOpen,
  RotateCcw,
  ShoppingCart,
  Layers,
  Loader2,
  Menu,
  X,
} from 'lucide-react';

const SIDEBAR_OPEN_STORAGE_KEY = 'stocksync_desktop_sidebar_open_v1';

const STATUS_CHIP_LABELS: Record<string, string> = {
  out_of_stock: 'Out of Stock',
  low_stock: 'Low Stock',
  in_stock: 'In Stock',
  reorder: 'Re-Order Needed',
};

const SORT_CHIP_LABELS: Record<string, string> = {
  'stock-desc': 'Sort: Stock High → Low',
  'sales-desc': 'Sort: Sales High → Low',
  'sales-asc': 'Sort: Sales Low → High',
  simplified: 'Sort: Name A–Z',
  sku: 'Sort: SKU Code',
  'mrp-desc': 'Sort: MRP High → Low',
  updated: 'Sort: Recently Updated',
};

interface ActiveFilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

const SALES_CHIP_LABELS: Record<string, string> = {
  '1m': '1 Month',
  '3m': '3 Months',
  '6m': '6 Months',
  '12m': '12 Months',
  all: 'All Time',
};

function DashboardContent() {
  const { filteredItems, filters, setFilters, stats, isLoading, loadingMessage } = useInventory();

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedDetailItem, setSelectedDetailItem] = useState<InventoryItem | null>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<InventoryItem | null>(null);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isReorderOpen, setIsReorderOpen] = useState(false);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isConsumptionOpen, setIsConsumptionOpen] = useState(false);

  // Desktop left sidebar visibility (persisted) + mobile/tablet drawer visibility
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_OPEN_STORAGE_KEY);
      if (saved !== null) return saved === 'true';
    } catch {
      // ignore storage errors
    }
    return true;
  });
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_OPEN_STORAGE_KEY, String(isDesktopSidebarOpen));
    } catch {
      // ignore storage errors
    }
  }, [isDesktopSidebarOpen]);

  // Keyboard shortcut: Ctrl + B (or Cmd + B) to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (window.innerWidth >= 1024) {
          setIsDesktopSidebarOpen((prev) => !prev);
        } else {
          setIsMobileDrawerOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Pagination for high performance across 3,500+ items
  const [displayCount, setDisplayCount] = useState(100);

  // Reset pagination when search or filters change
  useEffect(() => {
    setDisplayCount(100);
  }, [filters]);

  const displayedItems = filteredItems.slice(0, displayCount);
  const hasMore = displayCount < filteredItems.length;

  const handleOpenItemHistory = (item: InventoryItem) => {
    setSelectedHistoryItem(item);
    setIsHistoryOpen(true);
  };

  const handleOpenGlobalHistory = () => {
    setSelectedHistoryItem(null);
    setIsHistoryOpen(true);
  };

  const handleResetAllFilters = () => {
    setFilters((p) => ({
      ...p,
      search: '',
      category: 'all',
      color: 'all',
      status: 'all',
      sortBy: 'stock-asc',
      lowStockThreshold: 15,
      salesPeriod: '3m',
      salesActivity: 'all',
    }));
  };

  // Build removable chips for any active filter
  const activeChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];

    if (filters.search.trim()) {
      chips.push({
        key: 'search',
        label: `Search: "${filters.search.trim()}"`,
        onRemove: () => setFilters((p) => ({ ...p, search: '' })),
      });
    }

    if (filters.category !== 'all') {
      chips.push({
        key: 'category',
        label: filters.category,
        onRemove: () => setFilters((p) => ({ ...p, category: 'all' })),
      });
    }

    if (filters.color !== 'all') {
      chips.push({
        key: 'color',
        label: `Color: ${filters.color}`,
        onRemove: () => setFilters((p) => ({ ...p, color: 'all' })),
      });
    }

    if (filters.status !== 'all') {
      chips.push({
        key: 'status',
        label: STATUS_CHIP_LABELS[filters.status] || filters.status.replace('_', ' '),
        onRemove: () => setFilters((p) => ({ ...p, status: 'all' })),
      });
    }

    if (filters.salesPeriod !== 'all') {
      chips.push({
        key: 'salesPeriod',
        label:
          SALES_CHIP_LABELS[filters.salesPeriod] ||
          formatSalesPeriodLabel(filters.salesPeriod),
        onRemove: () => setFilters((p) => ({ ...p, salesPeriod: 'all' })),
      });
    }

    if (filters.salesActivity !== 'all') {
      chips.push({
        key: 'salesActivity',
        label: filters.salesActivity === 'with_sales' ? 'Has sales' : 'No sales',
        onRemove: () => setFilters((p) => ({ ...p, salesActivity: 'all' })),
      });
    }

    if (filters.sortBy !== 'stock-asc') {
      chips.push({
        key: 'sortBy',
        label: SORT_CHIP_LABELS[filters.sortBy] || `Sort: ${filters.sortBy}`,
        onRemove: () => setFilters((p) => ({ ...p, sortBy: 'stock-asc' })),
      });
    }

    if (filters.lowStockThreshold !== 15) {
      chips.push({
        key: 'threshold',
        label: `Alert ≤ ${filters.lowStockThreshold}`,
        onRemove: () => setFilters((p) => ({ ...p, lowStockThreshold: 15 })),
      });
    }

    return chips;
  }, [filters, setFilters]);

  const hasAnyNonDefaultFilter =
    Boolean(filters.search.trim()) ||
    filters.category !== 'all' ||
    filters.color !== 'all' ||
    filters.status !== 'all' ||
    filters.salesPeriod !== '3m' ||
    filters.salesActivity !== 'all' ||
    filters.sortBy !== 'stock-asc' ||
    filters.lowStockThreshold !== 15;

  return (
    <div className="min-h-screen bg-[var(--page-bg)] text-[var(--text-primary)] flex flex-col relative">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-[var(--overlay-bg)] flex flex-col items-center justify-center p-4 text-center">
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-6 max-w-sm w-full flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin mb-3" />
            <h3 className="text-[14px] font-medium text-[var(--text-primary)]">{loadingMessage}</h3>
            <p className="text-[12px] text-[var(--text-muted)] mt-1">
              Processing database records in background...
            </p>
          </div>
        </div>
      )}

      {/* Clean Top Navigation Header */}
      <Navbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        onOpenSync={() => setIsSyncOpen(true)}
        onOpenReorder={() => setIsReorderOpen(true)}
        onOpenAudit={() => setIsAuditOpen(true)}
        onOpenHistory={handleOpenGlobalHistory}
        onOpenConsumption={() => setIsConsumptionOpen(true)}
      />

      {/* Main Workspace Container: Hamburger/Filters Toggle + Left Sidebar + Right Content */}
      <div className="flex-1 w-full mx-auto px-4 sm:px-6 py-4 sm:py-5">
        {/* Top-Left Sidebar Toggle Bar (Hamburger / Filters button above the sidebar) */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            {/* Desktop Toggle Button */}
            <button
              type="button"
              onClick={() => setIsDesktopSidebarOpen((prev) => !prev)}
              className={`hidden lg:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors duration-150 ${
                isDesktopSidebarOpen
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]'
                  : 'bg-[var(--card-bg)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--table-hover)]'
              }`}
              aria-expanded={isDesktopSidebarOpen}
              title="Toggle filter sidebar (Ctrl+B)"
            >
              <Menu
                className={`w-4 h-4 ${
                  isDesktopSidebarOpen ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                }`}
              />
              <span>
                {isDesktopSidebarOpen ? 'Hide filters to expand grid' : 'Show filters'}
              </span>
              {!isDesktopSidebarOpen && activeChips.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[var(--accent)] text-white text-[11px] font-medium leading-none">
                  {activeChips.length}
                </span>
              )}
            </button>

            {/* Mobile / Tablet Drawer Trigger Button */}
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="lg:hidden inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--table-hover)] transition-colors duration-150"
            >
              <Menu className="w-4 h-4 text-[var(--text-muted)]" />
              <span>Filters</span>
              {activeChips.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[var(--accent)] text-white text-[11px] font-medium leading-none">
                  {activeChips.length}
                </span>
              )}
            </button>

            <span className="hidden xl:inline text-[11px] text-[var(--text-muted)]">
              Shortcut: Ctrl+B
            </span>
          </div>
        </div>

        {/* Left Sidebar + Main Right Content (CSS Grid 280px 1fr <-> 0px 1fr) */}
        <div
          className={`grid grid-cols-1 items-stretch transition-[grid-template-columns,gap] duration-250 ease-in-out ${
            isDesktopSidebarOpen
              ? 'lg:grid-cols-[280px_1fr] lg:gap-5'
              : 'lg:grid-cols-[0px_1fr] lg:gap-0'
          }`}
        >
          {/* Left Sticky Collapsible Sidebar (Desktop) & Slide-in Drawer (Mobile/Tablet) */}
          <FilterSidebar
            isDesktopOpen={isDesktopSidebarOpen}
            onToggleDesktop={() => setIsDesktopSidebarOpen((prev) => !prev)}
            isMobileOpen={isMobileDrawerOpen}
            onCloseMobile={() => setIsMobileDrawerOpen(false)}
            onResetAll={handleResetAllFilters}
            activeFilterCount={activeChips.length}
          />

          {/* Main Right Content Area */}
          <main className="min-w-0 space-y-5">
            {/* Sheet Sync Status Banner */}
            <ImportSheetBanner onOpenSync={() => setIsSyncOpen(true)} />

            {/* KPI Summary Cards */}
            <StatsCards onOpenReorder={() => setIsReorderOpen(true)} />

            {/* Results Bar + Active Removable Filter Chips */}
            <div className="space-y-2.5 px-0.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--text-muted)]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span>
                    Showing{' '}
                    <span className="text-[var(--text-primary)] font-medium">
                      {displayedItems.length.toLocaleString()}
                    </span>{' '}
                    of{' '}
                    <span className="text-[var(--text-primary)] font-medium">
                      {filteredItems.length.toLocaleString()}
                    </span>{' '}
                    articles
                  </span>
                  <span>
                    • {formatSalesPeriodLabel(filters.salesPeriod)} sales:{' '}
                    <span className="text-[var(--text-primary)] font-mono font-medium">
                      {stats.filteredSalesTotal.toLocaleString()}
                    </span>{' '}
                    units
                  </span>
                </div>

                {(hasAnyNonDefaultFilter || activeChips.length > 0) && (
                  <button
                    onClick={handleResetAllFilters}
                    className="text-[12px] text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium flex items-center gap-1 transition-colors duration-150"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset filters</span>
                  </button>
                )}
              </div>

              {/* Active Filter Removable Chips */}
              {activeChips.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {activeChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={chip.onRemove}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)] hover:bg-[#FBE4C8] text-[12px] font-medium transition-colors duration-150"
                      title={`Remove ${chip.label} filter`}
                    >
                      <span>{chip.label}</span>
                      <X className="w-3 h-3 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Inventory Items Content */}
            {filteredItems.length === 0 ? (
              <div className="py-16 text-center space-y-3 bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-8">
                <PackageOpen className="w-10 h-10 text-[var(--text-muted)] mx-auto" />
                <h3 className="text-[14px] font-medium text-[var(--text-primary)]">
                  No articles match your criteria
                </h3>
                <p className="text-[12px] text-[var(--text-muted)] max-w-sm mx-auto">
                  Try adjusting your search query, clearing category filters, or switching stock status.
                </p>
                <button
                  onClick={handleResetAllFilters}
                  className="px-4 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[12px] font-medium transition-colors duration-150"
                >
                  Clear all filters
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 gap-4 transition-all duration-250 ${
                  isDesktopSidebarOpen
                    ? 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
                    : 'md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
                }`}
              >
                {displayedItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onOpenDetails={(it) => setSelectedDetailItem(it)}
                    onOpenItemHistory={handleOpenItemHistory}
                  />
                ))}
              </div>
            ) : (
              <ItemTable
                items={displayedItems}
                onOpenDetails={(it) => setSelectedDetailItem(it)}
                onOpenItemHistory={handleOpenItemHistory}
              />
            )}

            {/* Load More Button for large catalogue (3,500+ items) */}
            {hasMore && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 pb-6">
                <button
                  onClick={() => setDisplayCount((c) => c + 150)}
                  className="px-4 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[13px] font-medium transition-colors duration-150"
                >
                  Load next 150 articles ({(filteredItems.length - displayCount).toLocaleString()} remaining)
                </button>

                {filteredItems.length - displayCount <= 1000 && (
                  <button
                    onClick={() => setDisplayCount(filteredItems.length)}
                    className="px-4 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[13px] font-medium transition-colors duration-150"
                  >
                    Show all {filteredItems.length.toLocaleString()} articles
                  </button>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Floating Bottom Quick Action on Mobile */}
      <div className="fixed bottom-4 right-4 sm:hidden z-40 flex items-center gap-2">
        <button
          onClick={() => setIsAuditOpen(true)}
          className="p-3 rounded-lg bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border)] transition-colors duration-150"
          title="Rapid Cycle Count"
        >
          <Layers className="w-5 h-5 text-[var(--text-muted)]" />
        </button>
        {stats.reorderCount > 0 && (
          <button
            onClick={() => setIsReorderOpen(true)}
            className="p-3 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white relative transition-colors duration-150"
            title="Re-order alerts"
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-[var(--header-bg)] text-white text-[11px] font-medium rounded-full flex items-center justify-center border border-white">
              {stats.reorderCount}
            </span>
          </button>
        )}
      </div>

      {/* Modals & Drawers */}
      <ItemDetailModal
        item={selectedDetailItem}
        onClose={() => setSelectedDetailItem(null)}
        onOpenHistory={handleOpenItemHistory}
      />

      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        selectedItem={selectedHistoryItem}
        onSelectItem={(item) => {
          setSelectedHistoryItem(item);
        }}
      />

      <ReorderModal
        isOpen={isReorderOpen}
        onClose={() => setIsReorderOpen(false)}
        onOpenConsumption={() => setIsConsumptionOpen(true)}
      />

      <SyncModal
        isOpen={isSyncOpen}
        onClose={() => setIsSyncOpen(false)}
      />

      <AuditModeModal
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
      />

      <ConsumptionCalculatorModal
        isOpen={isConsumptionOpen}
        onClose={() => setIsConsumptionOpen(false)}
      />
    </div>
  );
}

export default function App() {
  // Register service worker for offline support
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.warn('ServiceWorker registration error:', err);
        });
      });
    }
  }, []);

  return (
    <InventoryProvider>
      <DashboardContent />
    </InventoryProvider>
  );
}
