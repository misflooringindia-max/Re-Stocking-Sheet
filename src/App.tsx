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
import { InventoryItem } from './types/inventory';
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

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white relative">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
          <h3 className="text-base font-bold text-white">{loadingMessage}</h3>
          <p className="text-xs text-slate-400 mt-1">Processing database records in background...</p>
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
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 space-y-4">
        {/* Full Sheet 3500+ Importer Banner */}
        <ImportSheetBanner onOpenSync={() => setIsSyncOpen(true)} />

        {/* KPI Summary Cards */}
        <StatsCards onOpenReorder={() => setIsReorderOpen(true)} />

        {/* Results Bar */}
        <div className="flex items-center justify-between text-xs text-slate-300 px-1 pt-1 font-medium">
          <div>
            Showing <strong className="text-white font-bold">{displayedItems.length.toLocaleString()}</strong> of{' '}
            <strong className="text-white font-bold">{filteredItems.length.toLocaleString()}</strong> articles
            {filters.search && (
              <span className="ml-1 text-indigo-300 font-semibold">
                matching "{filters.search}"
              </span>
            )}
            {filters.status !== 'all' && (
              <span className="ml-1 text-amber-300 font-bold uppercase">
                [{filters.status.replace('_', ' ')}]
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(filters.search || filters.category !== 'all' || filters.color !== 'all' || filters.status !== 'all') && (
              <button
                onClick={() =>
                  setFilters((p) => ({
                    ...p,
                    search: '',
                    category: 'all',
                    color: 'all',
                    status: 'all',
                  }))
                }
                className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset filters
              </button>
            )}
          </div>
        </div>

        {/* Inventory Items Content */}
        {filteredItems.length === 0 ? (
          <div className="py-20 text-center space-y-3 bg-slate-800/90 rounded-3xl border border-slate-700 p-8 shadow-xs">
            <PackageOpen className="w-12 h-12 text-slate-500 mx-auto" />
            <h3 className="text-base font-extrabold text-white">No articles match your criteria</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
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
                }))
              }
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs"
            >
              Clear All Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
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
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 pb-8">
            <button
              onClick={() => setDisplayCount((c) => c + 150)}
              className="px-6 py-2.5 rounded-2xl bg-slate-800 border border-slate-700 hover:bg-slate-750 hover:border-slate-600 text-white text-xs font-bold transition-all shadow-xs"
            >
              Load Next 150 Articles ({(filteredItems.length - displayCount).toLocaleString()} remaining)
            </button>

            {filteredItems.length - displayCount <= 1000 && (
              <button
                onClick={() => setDisplayCount(filteredItems.length)}
                className="px-4 py-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Show All {filteredItems.length.toLocaleString()} Articles
              </button>
            )}
          </div>
        )}
      </main>

      {/* Floating Bottom Quick Action on Mobile */}
      <div className="fixed bottom-3 right-3 sm:hidden z-40 flex items-center gap-2">
        <button
          onClick={() => setIsAuditOpen(true)}
          className="p-3 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 border border-white/20"
          title="Rapid Cycle Count"
        >
          <Layers className="w-5 h-5" />
        </button>
        {stats.reorderCount > 0 && (
          <button
            onClick={() => setIsReorderOpen(true)}
            className="p-3 rounded-full bg-amber-600 text-white shadow-lg shadow-amber-600/40 border border-white/20 relative"
            title="Re-Order Alerts"
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
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
