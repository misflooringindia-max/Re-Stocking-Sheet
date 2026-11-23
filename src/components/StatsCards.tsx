import React from 'react';
import { useInventory } from '../context/InventoryContext';
import {
  Package,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  IndianRupee,
  ShoppingCart,
  Sliders,
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
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Inventory Value */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-normal text-[var(--text-muted)]">
              Inventory Value
            </span>
            <IndianRupee className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          </div>
          <div className="mt-2.5">
            <div className="text-[24px] leading-tight font-medium text-[var(--text-primary)] tracking-tight">
              {formatCurrency(stats.inventoryValue)}
            </div>
            <div className="text-[12px] text-[var(--text-muted)] mt-1">
              Based on MRP valuation
            </div>
          </div>
        </div>

        {/* Total SKUs */}
        <button
          onClick={() => handleStatusFilter('all')}
          className={`text-left bg-[var(--card-bg)] border rounded-xl p-4 flex flex-col justify-between transition-colors duration-150 ${
            filters.status === 'all'
              ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]'
              : 'border-[var(--border)] hover:border-[#BFC4CC]'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[12px] font-normal text-[var(--text-muted)]">
              Total SKUs
            </span>
            <Package className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          </div>
          <div className="mt-2.5">
            <div className="text-[24px] leading-tight font-medium text-[var(--text-primary)] tracking-tight">
              {stats.totalSkus.toLocaleString()}
            </div>
            <div className="text-[12px] text-[var(--text-muted)] mt-1">
              {stats.totalUnits.toLocaleString()} units in stock
            </div>
          </div>
        </button>

        {/* Out of Stock */}
        <button
          onClick={() => handleStatusFilter('out_of_stock')}
          className={`text-left bg-[var(--card-bg)] border rounded-xl p-4 flex flex-col justify-between transition-colors duration-150 ${
            filters.status === 'out_of_stock'
              ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]'
              : 'border-[var(--border)] hover:border-[#BFC4CC]'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[12px] font-normal text-[var(--text-muted)]">
              Out of Stock
            </span>
            <XCircle className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          </div>
          <div className="mt-2.5">
            <div className="text-[24px] leading-tight font-medium text-[var(--status-out-text)] tracking-tight flex items-baseline gap-1.5">
              <span>{stats.outOfStockCount.toLocaleString()}</span>
              <span className="text-[12px] font-normal text-[var(--text-muted)]">
                ({Math.round((stats.outOfStockCount / (stats.totalSkus || 1)) * 100)}%)
              </span>
            </div>
            <div className="text-[12px] text-[var(--text-muted)] mt-1">
              0 units remaining
            </div>
          </div>
        </button>

        {/* Low Stock */}
        <button
          onClick={() => handleStatusFilter('low_stock')}
          className={`text-left bg-[var(--card-bg)] border rounded-xl p-4 flex flex-col justify-between transition-colors duration-150 ${
            filters.status === 'low_stock'
              ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]'
              : 'border-[var(--border)] hover:border-[#BFC4CC]'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[12px] font-normal text-[var(--text-muted)]">
              Low Stock
            </span>
            <AlertTriangle className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          </div>
          <div className="mt-2.5">
            <div className="text-[24px] leading-tight font-medium text-[var(--status-low-text)] tracking-tight">
              {stats.lowStockCount.toLocaleString()}
            </div>
            <div className="text-[12px] text-[var(--text-muted)] mt-1">
              Stock ≤ {filters.lowStockThreshold} units
            </div>
          </div>
        </button>

        {/* In Stock */}
        <button
          onClick={() => handleStatusFilter('in_stock')}
          className={`text-left bg-[var(--card-bg)] border rounded-xl p-4 flex flex-col justify-between transition-colors duration-150 ${
            filters.status === 'in_stock'
              ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]'
              : 'border-[var(--border)] hover:border-[#BFC4CC]'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[12px] font-normal text-[var(--text-muted)]">
              In Stock
            </span>
            <CheckCircle2 className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          </div>
          <div className="mt-2.5">
            <div className="text-[24px] leading-tight font-medium text-[var(--status-in-text)] tracking-tight">
              {stats.healthyCount.toLocaleString()}
            </div>
            <div className="text-[12px] text-[var(--text-muted)] mt-1">
              Optimal inventory levels
            </div>
          </div>
        </button>

        {/* Re-Order Needed */}
        <button
          type="button"
          onClick={onOpenReorder}
          className="text-left bg-[var(--card-bg)] border border-[var(--border)] hover:border-[var(--accent)] rounded-xl p-4 flex flex-col justify-between transition-colors duration-150 group"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[12px] font-normal text-[var(--text-muted)]">
              Re-Order Needed
            </span>
            <ShoppingCart className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          </div>
          <div className="mt-2.5">
            <div className="text-[24px] leading-tight font-medium text-[var(--text-primary)] tracking-tight">
              {stats.reorderCount.toLocaleString()}
            </div>
            <div className="text-[12px] font-medium text-[var(--accent)] group-hover:text-[var(--accent-hover)] mt-1">
              Generate purchase order →
            </div>
          </div>
        </button>
      </div>

      {/* Threshold setting strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl text-[12px] text-[var(--text-muted)]">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="font-medium text-[var(--text-primary)]">Low-stock alert threshold:</span>
          <span className="font-medium text-[var(--accent)] px-2 py-0.5 bg-[var(--accent-soft)] border border-[var(--accent)] rounded-lg">
            ≤ {filters.lowStockThreshold} units
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-[var(--text-muted)] hidden sm:inline mr-1">
            Set alert at:
          </span>
          {[5, 10, 15, 20, 30].map((num) => (
            <button
              key={num}
              onClick={() => setFilters((p) => ({ ...p, lowStockThreshold: num }))}
              className={`px-2.5 py-1 rounded-lg text-[12px] border transition-colors duration-150 ${
                filters.lowStockThreshold === num
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)] font-medium'
                  : 'bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--table-hover)] font-normal'
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
