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

  // Target stock level for replenishment calculation
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[var(--overlay-bg)]">
      <div className="w-full max-w-4xl bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--table-divider)] bg-[var(--card-bg)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--surface-subtle)] text-[var(--text-muted)] border border-[var(--border)]">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-medium text-[var(--text-primary)]">
                Re-order &amp; replenishment plan
              </h2>
              <p className="text-[12px] text-[var(--text-muted)]">
                Triggered automatically for items with stock ≤ {filters.lowStockThreshold} units
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--table-hover)] transition-colors duration-150"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Reorder Config & Summary KPI bar */}
        <div className="p-4 bg-[var(--page-bg)] border-b border-[var(--table-divider)] grid grid-cols-1 sm:grid-cols-4 gap-3 text-[12px]">
          {/* Target Buffer Level */}
          <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] flex flex-col justify-between">
            <span className="text-[12px] font-normal text-[var(--text-muted)]">
              Replenish target qty
            </span>
            <div className="flex items-center gap-1.5 mt-2">
              {[25, 50, 100, 200].map((t) => (
                <button
                  key={t}
                  onClick={() => setTargetStock(t)}
                  className={`px-2.5 py-1 rounded-lg text-[12px] border transition-colors duration-150 ${
                    targetStock === t
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)] font-medium'
                      : 'bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--table-hover)] font-normal'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Items Flagged */}
          <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] flex flex-col justify-between">
            <span className="text-[12px] font-normal text-[var(--text-muted)]">
              Articles flagged
            </span>
            <div className="text-[24px] leading-tight font-medium text-[var(--text-primary)] mt-1">
              {reorderList.length.toLocaleString()}{' '}
              <span className="text-[12px] font-normal text-[var(--text-muted)]">products</span>
            </div>
          </div>

          {/* Total Units to Procure */}
          <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] flex flex-col justify-between">
            <span className="text-[12px] font-normal text-[var(--text-muted)]">
              Total units to order
            </span>
            <div className="text-[24px] leading-tight font-medium text-[var(--text-primary)] mt-1">
              {totalUnitsNeeded.toLocaleString()}{' '}
              <span className="text-[12px] font-normal text-[var(--text-muted)]">units</span>
            </div>
          </div>

          {/* Estimated Value */}
          <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] flex flex-col justify-between">
            <span className="text-[12px] font-normal text-[var(--text-muted)]">
              Est. batch value
            </span>
            <div className="text-[24px] leading-tight font-medium text-[var(--text-primary)] mt-1 font-mono">
              ₹{totalEstimatedCost.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Scrollable Reorder Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {reorderList.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Check className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
              <h3 className="text-[14px] font-medium text-[var(--text-primary)]">
                All stock levels optimal
              </h3>
              <p className="text-[12px] text-[var(--text-muted)] max-w-sm mx-auto">
                No articles currently fall below your low-stock threshold of {filters.lowStockThreshold} units.
              </p>
            </div>
          ) : (
            <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--card-bg)]">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead>
                  <tr className="bg-[var(--table-header-bg)] border-b border-[var(--table-divider)] text-[12px] font-medium text-[var(--text-muted)]">
                    <th className="py-2.5 px-3 font-medium">Article</th>
                    <th className="py-2.5 px-2.5 font-medium">Uniware SKU</th>
                    <th className="py-2.5 px-2.5 font-medium">Current stock</th>
                    <th className="py-2.5 px-2.5 font-medium">Suggested order</th>
                    <th className="py-2.5 px-2.5 font-medium">Unit MRP</th>
                    <th className="py-2.5 px-3 text-right font-medium">Est. cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--table-divider)] font-normal">
                  {reorderList.map((item) => (
                    <tr key={item.id} className="hover:bg-[var(--table-hover)] transition-colors duration-150">
                      <td className="py-2.5 px-3 flex items-center gap-2.5">
                        <ItemImage
                          url={item.resolvedImageUrl}
                          rawLink={item.imageLink}
                          name={item.simplified}
                          itemCategory={item.item}
                          color={item.color}
                          className="w-9 h-9 rounded-lg"
                        />
                        <div className="min-w-0 max-w-[220px]">
                          <div className="font-medium text-[var(--text-primary)] truncate">
                            {item.simplified}
                          </div>
                          <div className="text-[12px] text-[var(--text-muted)]">
                            {item.item} • {item.color}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-2.5 font-mono text-[12px] text-[var(--text-muted)] select-all">
                        {item.sku}
                      </td>
                      <td className="py-2.5 px-2.5">
                        <span
                          className={`font-mono font-medium px-2 py-0.5 rounded-full text-[11px] ${
                            item.stock === 0
                              ? 'bg-[var(--status-out-bg)] text-[var(--status-out-text)]'
                              : 'bg-[var(--status-low-bg)] text-[var(--status-low-text)]'
                          }`}
                        >
                          {item.stock} left
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 font-mono font-medium text-[var(--accent)]">
                        +{item.suggestedReorder}
                      </td>
                      <td className="py-2.5 px-2.5 text-[var(--text-primary)] font-mono font-medium">
                        {item.mrp > 0 ? `₹${item.mrp}` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-[var(--text-primary)]">
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
        <div className="p-4 border-t border-[var(--table-divider)] bg-[var(--card-bg)] flex flex-wrap items-center justify-between gap-3">
          <div className="text-[12px] text-[var(--text-muted)]">
            <span className="font-medium text-[var(--text-primary)]">
              {reorderList.length.toLocaleString()}
            </span>{' '}
            products require restocking
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Copy for Google Sheet */}
            <button
              onClick={handleCopyTsv}
              disabled={reorderList.length === 0}
              className="px-3.5 py-2 rounded-lg bg-[var(--card-bg)] hover:bg-[var(--table-hover)] disabled:opacity-40 text-[var(--text-primary)] text-[13px] font-medium flex items-center gap-1.5 transition-colors duration-150 border border-[var(--border)]"
              title="Copy table to paste directly into Google Sheet"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-[var(--accent)]" />
                  <span>Copied TSV</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[var(--text-muted)]" />
                  <span>Copy for sheet</span>
                </>
              )}
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportReorderCsv}
              disabled={reorderList.length === 0}
              className="px-3.5 py-2 rounded-lg bg-[var(--card-bg)] hover:bg-[var(--table-hover)] disabled:opacity-40 text-[var(--text-primary)] text-[13px] font-medium flex items-center gap-1.5 transition-colors duration-150 border border-[var(--border)]"
            >
              <Download className="w-4 h-4 text-[var(--text-muted)]" />
              <span>Export CSV</span>
            </button>

            {/* Primary Action: Bulk Replenish */}
            <button
              onClick={handleApplyRestockAll}
              disabled={reorderList.length === 0}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-white text-[13px] font-medium flex items-center gap-1.5 transition-colors duration-150"
            >
              {applied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Restocked</span>
                </>
              ) : (
                <>
                  <PackagePlus className="w-4 h-4" />
                  <span>Apply restock ({targetStock} ea)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
