import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { ItemImage } from './ItemImage';
import {
  X,
  ShoppingCart,
  Download,
  Copy,
  Check,
  PackagePlus,
} from 'lucide-react';

interface ReorderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReorderModal: React.FC<ReorderModalProps> = ({ isOpen, onClose }) => {
  const { items, filters, batchUpdateStock } = useInventory();

  // Target stock level for replenishment calculation (e.g. aim for 50 or 100 units)
  const [targetStock, setTargetStock] = useState<number>(50);
  const [copied, setCopied] = useState<boolean>(false);
  const [applied, setApplied] = useState<boolean>(false);

  // Filter items needing reorder (stock <= lowStockThreshold)
  const reorderList = useMemo(() => {
    return items
      .filter((it) => it.stock <= filters.lowStockThreshold)
      .map((it) => {
        const needed = Math.max(0, targetStock - it.stock);
        const estimatedValue = needed * (it.mrp || 0);
        return {
          ...it,
          suggestedReorder: needed,
          estimatedValue,
        };
      })
      .sort((a, b) => a.stock - b.stock);
  }, [items, filters.lowStockThreshold, targetStock]);

  const totalUnitsNeeded = useMemo(() => {
    return reorderList.reduce((acc, curr) => acc + curr.suggestedReorder, 0);
  }, [reorderList]);

  const totalEstimatedCost = useMemo(() => {
    return reorderList.reduce((acc, curr) => acc + curr.estimatedValue, 0);
  }, [reorderList]);

  if (!isOpen) return null;

  // Export re-order CSV
  const handleExportReorderCsv = () => {
    const headers = [
      'Uniware SKU',
      'Simplified Name',
      'Category',
      'Color',
      'Size',
      'Current Stock',
      'Target Stock',
      'Suggested Re-Order QTY',
      'Unit MRP',
      'Estimated Value',
      'ASIN',
    ];

    const rows = reorderList.map((it) => [
      `"${it.sku.replace(/"/g, '""')}"`,
      `"${it.simplified.replace(/"/g, '""')}"`,
      `"${it.item.replace(/"/g, '""')}"`,
      `"${it.color.replace(/"/g, '""')}"`,
      `"${it.size.replace(/"/g, '""')}"`,
      it.stock,
      targetStock,
      it.suggestedReorder,
      it.mrp,
      it.estimatedValue,
      it.asin || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ReOrder_Purchase_Plan_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy to clipboard for instant Google Sheet paste
  const handleCopyTsv = async () => {
    const headers = [
      'Uniware SKU',
      'Simplified Name',
      'Category',
      'Color',
      'Size',
      'Current Stock',
      'Suggested Re-Order QTY',
      'MRP',
      'Estimated Value',
    ];

    const rows = reorderList.map((it) => [
      it.sku,
      it.simplified,
      it.item,
      it.color,
      it.size,
      it.stock,
      it.suggestedReorder,
      it.mrp,
      it.estimatedValue,
    ]);

    const tsvContent = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
    try {
      await navigator.clipboard.writeText(tsvContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  // Bulk Apply Restock directly into master inventory
  const handleApplyRestockAll = () => {
    const updates = reorderList.map((it) => ({
      id: it.id,
      stock: targetStock,
      note: `Bulk replenishment to target ${targetStock}`,
    }));
    batchUpdateStock(updates);
    setApplied(true);
    setTimeout(() => {
      setApplied(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-700/80 bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                Re-Order & Replenishment Intelligence
              </h2>
              <p className="text-xs text-slate-400">
                Triggered automatically for items with stock ≤ {filters.lowStockThreshold} units
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Reorder Config & Summary KPI bar */}
        <div className="p-4 bg-slate-850/60 bg-slate-900 border-b border-slate-700/80 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          {/* Target Buffer Level */}
          <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Replenish Target QTY
            </span>
            <div className="flex items-center gap-1.5 mt-2">
              {[25, 50, 100, 200].map((t) => (
                <button
                  key={t}
                  onClick={() => setTargetStock(t)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                    targetStock === t
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Items Flagged */}
          <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Articles Flagged
            </span>
            <div className="text-xl font-extrabold text-amber-300 mt-1">
              {reorderList.length}{' '}
              <span className="text-xs font-semibold text-slate-400">products</span>
            </div>
          </div>

          {/* Total Units to Procure */}
          <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Units to Order
            </span>
            <div className="text-xl font-extrabold text-white mt-1">
              {totalUnitsNeeded.toLocaleString()}{' '}
              <span className="text-xs font-semibold text-slate-400">units</span>
            </div>
          </div>

          {/* Estimated Value */}
          <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Est. Batch Value
            </span>
            <div className="text-xl font-extrabold text-emerald-400 mt-1 font-mono">
              ₹{totalEstimatedCost.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Scrollable Reorder Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {reorderList.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Check className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-sm font-bold text-white">All Stock Levels Optimal!</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No articles currently fall below your low-stock threshold of {filters.lowStockThreshold} units.
              </p>
            </div>
          ) : (
            <div className="border border-slate-700 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800 border-b border-slate-700 text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Article</th>
                    <th className="py-2.5 px-2">Uniware SKU</th>
                    <th className="py-2.5 px-2">Current Stock</th>
                    <th className="py-2.5 px-2 text-amber-300 font-bold">Suggested Order</th>
                    <th className="py-2.5 px-2">Unit MRP</th>
                    <th className="py-2.5 px-3 text-right">Est. Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60 font-medium">
                  {reorderList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/60">
                      <td className="py-2.5 px-3 flex items-center gap-2.5">
                        <ItemImage
                          url={item.resolvedImageUrl}
                          rawLink={item.imageLink}
                          name={item.simplified}
                          itemCategory={item.item}
                          color={item.color}
                          className="w-9 h-9 rounded-lg shadow-2xs"
                        />
                        <div className="min-w-0 max-w-[220px]">
                          <div className="font-bold text-white truncate">
                            {item.simplified}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium">
                            {item.item} • {item.color}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 font-mono text-indigo-300 font-semibold select-all">
                        {item.sku}
                      </td>
                      <td className="py-2.5 px-2">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-xs border ${
                            item.stock === 0
                              ? 'bg-rose-950/70 text-rose-300 border-rose-700'
                              : 'bg-amber-950/70 text-amber-300 border-amber-700'
                          }`}
                        >
                          {item.stock} left
                        </span>
                      </td>
                      <td className="py-2.5 px-2 font-mono font-extrabold text-sm text-amber-300">
                        +{item.suggestedReorder}
                      </td>
                      <td className="py-2.5 px-2 text-slate-200 font-mono font-bold">
                        {item.mrp > 0 ? `₹${item.mrp}` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                        ₹{item.estimatedValue.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-700/80 bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400 font-medium">
            <strong className="text-white">{reorderList.length}</strong> products require restocking
          </div>

          <div className="flex items-center gap-2">
            {/* Copy for Google Sheet */}
            <button
              onClick={handleCopyTsv}
              disabled={reorderList.length === 0}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700 shadow-xs"
              title="Copy table to paste directly into Google Sheet"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copied TSV!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy for Sheet</span>
                </>
              )}
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportReorderCsv}
              disabled={reorderList.length === 0}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700 shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Export CSV</span>
            </button>

            {/* Quick Batch Replenish */}
            <button
              onClick={handleApplyRestockAll}
              disabled={reorderList.length === 0}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shadow-emerald-700/20"
            >
              {applied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Restocked!</span>
                </>
              ) : (
                <>
                  <PackagePlus className="w-4 h-4" />
                  <span>Apply Restock ({targetStock} ea)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
