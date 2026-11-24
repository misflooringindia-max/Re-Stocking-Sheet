import React, { useState, useEffect } from 'react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { Navbar } from './components/Navbar';
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
} from 'lucide-react';

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

  const statusLabels: Record<string, string> = {
    out_of_stock: 'Out of stock',
    low_stock: 'Low stock',
    in_stock: 'In stock',
  };

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

      {/* Navigation Header */}
      <Navbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        onOpenSync={() => setIsSyncOpen(true)}
        onOpenReorder={() => setIsReorderOpen(true)}
        onOpenAudit={() => setIsAuditOpen(true)}
        onOpenHistory={handleOpenGlobalHistory}
        onOpenConsumption={() => setIsConsumptionOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-5">
        {/* Full Sheet 3500+ Importer Banner */}
        <ImportSheetBanner onOpenSync={() => setIsSyncOpen(true)} />

        {/* KPI Summary Cards */}
        <StatsCards onOpenReorder={() => setIsReorderOpen(true)} />

        {/* Results Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--text-muted)] px-0.5">
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
            {filters.search && (
              <span className="text-[var(--accent)] font-medium">
                matching "{filters.search}"
              </span>
            )}
            {filters.status !== 'all' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)] text-[11px] font-medium">
                {statusLabels[filters.status] || filters.status.replace('_', ' ')}
              </span>
            )}
            {filters.salesActivity !== 'all' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)] text-[11px] font-medium">
                {filters.salesActivity === 'with_sales' ? 'Has sales' : 'Zero sales'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(filters.search ||
              filters.category !== 'all' ||
              filters.color !== 'all' ||
              filters.status !== 'all' ||
              filters.salesActivity !== 'all') && (
              <button
                onClick={() =>
                  setFilters((p) => ({
                    ...p,
                    search: '',
                    category: 'all',
                    color: 'all',
                    status: 'all',
                    salesActivity: 'all',
                  }))
                }
                className="text-[12px] text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium flex items-center gap-1 transition-colors duration-150"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset filters</span>
              </button>
            )}
          </div>
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
              onClick={() =>
                setFilters((p) => ({
                  ...p,
                  search: '',
                  category: 'all',
                  color: 'all',
                  status: 'all',
                  salesActivity: 'all',
                }))
              }
              className="px-4 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[12px] font-medium transition-colors duration-150"
            >
              Clear all filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
