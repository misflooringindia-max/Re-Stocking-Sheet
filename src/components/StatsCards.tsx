import React from 'react';
import { useInventory } from '../context/InventoryContext';
import { 
  Package, 
  AlertTriangle, 
  XCircle, 
  CheckCircle2, 
  IndianRupee, 
  ShoppingCart,
  Sliders
} from 'lucide-react';
import { StockStatus } from '../types/inventory';

interface StatsCardsProps {
  onOpenReorder: () => void;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ onOpenReorder }) => {
  const { stats, filters, setFilters } = useInventory();

  const handleStatusFilter = (status: StockStatus) => {
    setFilters((prev) => ({
      ...prev,
      status: prev.status === status ? 'all' : status,
    }));
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Value */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3.5 flex flex-col justify-between shadow-xs hover:border-slate-600 transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Inventory Value</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-extrabold text-white tracking-tight">
              {formatCurrency(stats.inventoryValue)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Based on MRP valuation
            </div>
          </div>
        </div>

        {/* Total SKUs & Units */}
        <button
          onClick={() => handleStatusFilter('all')}
          className={`text-left bg-slate-800/90 border rounded-2xl p-3.5 flex flex-col justify-between shadow-xs transition-all ${
            filters.status === 'all'
              ? 'border-indigo-500 ring-2 ring-indigo-500/30'
              : 'border-slate-700/80 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 w-full">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total SKUs</span>
            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-extrabold text-white tracking-tight">
              {stats.totalSkus} <span className="text-xs font-semibold text-slate-400">items</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {stats.totalUnits.toLocaleString()} total units in stock
            </div>
          </div>
        </button>

        {/* Out of Stock (0) */}
        <button
          onClick={() => handleStatusFilter('out_of_stock')}
          className={`text-left border rounded-2xl p-3.5 flex flex-col justify-between shadow-xs transition-all ${
            filters.status === 'out_of_stock'
              ? 'bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/30'
              : 'bg-slate-800/90 border-slate-700/80 hover:border-rose-600/60'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 w-full">
            <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">Out of Stock</span>
            <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-extrabold text-rose-300 tracking-tight flex items-baseline gap-1.5">
              {stats.outOfStockCount}
              <span className="text-xs font-semibold text-rose-400/80">
                ({Math.round((stats.outOfStockCount / (stats.totalSkus || 1)) * 100)}%)
              </span>
            </div>
            <div className="text-[11px] text-rose-400 mt-0.5 font-medium flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Critical: 0 units left
            </div>
          </div>
        </button>

        {/* Low Stock Alert */}
        <button
          onClick={() => handleStatusFilter('low_stock')}
          className={`text-left border rounded-2xl p-3.5 flex flex-col justify-between shadow-xs transition-all ${
            filters.status === 'low_stock'
              ? 'bg-amber-950/60 border-amber-500 ring-2 ring-amber-500/30'
              : 'bg-slate-800/90 border-slate-700/80 hover:border-amber-600/60'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 w-full">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Low Stock</span>
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-extrabold text-amber-300 tracking-tight">
              {stats.lowStockCount} <span className="text-xs font-semibold text-slate-400">SKUs</span>
            </div>
            <div className="text-[11px] text-amber-400 mt-0.5 font-medium">
              Stock ≤ {filters.lowStockThreshold} units
            </div>
          </div>
        </button>

        {/* Healthy In Stock */}
        <button
          onClick={() => handleStatusFilter('in_stock')}
          className={`text-left border rounded-2xl p-3.5 flex flex-col justify-between shadow-xs transition-all ${
            filters.status === 'in_stock'
              ? 'bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/30'
              : 'bg-slate-800/90 border-slate-700/80 hover:border-emerald-600/60'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 w-full">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">In Stock</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-extrabold text-emerald-300 tracking-tight">
              {stats.healthyCount} <span className="text-xs font-semibold text-slate-400">SKUs</span>
            </div>
            <div className="text-[11px] text-emerald-400 mt-0.5 font-medium">
              Optimal inventory levels
            </div>
          </div>
        </button>

        {/* Re-Order Button Card */}
        <div
          onClick={onOpenReorder}
          className="cursor-pointer group relative overflow-hidden bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-2xl p-3.5 flex flex-col justify-between shadow-md shadow-indigo-900/30 hover:shadow-lg transition-all hover:scale-[1.01] border border-indigo-400/30"
        >
          <div className="flex items-center justify-between text-indigo-100 w-full">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Re-Order Needed
            </span>
            <div className="p-1.5 rounded-lg bg-white/20 text-white group-hover:bg-white group-hover:text-indigo-700 transition-colors">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-extrabold text-white tracking-tight flex items-baseline gap-2">
              {stats.reorderCount}
              <span className="text-xs font-bold text-indigo-950 bg-white px-2 py-0.5 rounded-full shadow-xs">
                Alerts
              </span>
            </div>
            <div className="text-[11px] text-indigo-100 mt-0.5 group-hover:underline flex items-center gap-1 font-semibold">
              Generate purchase order →
            </div>
          </div>
        </div>
      </div>

      {/* Threshold setting strip */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-slate-800/90 border border-slate-700/80 rounded-xl text-xs text-slate-300 shadow-xs">
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-semibold text-slate-200">Low-Stock Alert Threshold:</span>
          <span className="font-bold text-indigo-300 px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/30 rounded-md">
            ≤ {filters.lowStockThreshold} units
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Set alert at:</span>
          {[5, 10, 15, 20, 30].map((num) => (
            <button
              key={num}
              onClick={() => setFilters((p) => ({ ...p, lowStockThreshold: num }))}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                filters.lowStockThreshold === num
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
