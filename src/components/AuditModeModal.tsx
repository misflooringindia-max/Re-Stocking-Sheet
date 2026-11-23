import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { InventoryItem } from '../types/inventory';
import { ItemImage } from './ItemImage';
import {
  X,
  QrCode,
  Search,
  Plus,
  Minus,
  PackageCheck,
} from 'lucide-react';

interface AuditModeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuditModeModal: React.FC<AuditModeModalProps> = ({ isOpen, onClose }) => {
  const { items, updateStock } = useInventory();

  const [query, setQuery] = useState('');
  const [activeItem, setActiveItem] = useState<InventoryItem | null>(null);
  const [countedQty, setCountedQty] = useState('');
  const [auditSuccess, setAuditSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;

    const matched = items.find(
      (it) =>
        it.sku.toLowerCase() === q ||
        it.asin.toLowerCase() === q ||
        it.ean.toLowerCase() === q ||
        it.simplified.toLowerCase().includes(q)
    );

    if (matched) {
      setActiveItem(matched);
      setCountedQty(matched.stock.toString());
      setAuditSuccess(null);
    } else {
      setAuditSuccess('No SKU or ASIN matched.');
    }
  };

  const handleApplyCount = () => {
    if (!activeItem) return;
    const parsed = parseInt(countedQty.trim(), 10);
    if (!isNaN(parsed) && parsed >= 0) {
      updateStock(activeItem.id, parsed, 'Warehouse physical cycle count');
      setAuditSuccess(`Saved: ${activeItem.sku} stock updated to ${parsed}`);
      setActiveItem((prev) => (prev ? { ...prev, stock: parsed } : null));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[var(--overlay-bg)]">
      <div className="w-full max-w-xl bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--table-divider)] bg-[var(--card-bg)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[var(--surface-subtle)] text-[var(--text-muted)] border border-[var(--border)]">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[14px] font-medium text-[var(--text-primary)]">
                Rapid warehouse cycle count &amp; audit mode
              </h2>
              <p className="text-[12px] text-[var(--text-muted)]">
                Scan or type SKU / ASIN / EAN to audit and update stock
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

        {/* Input Bar */}
        <div className="p-4 sm:p-5 space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Scan barcode or type SKU (e.g. 3D_Mat_Leaf_Green)..."
                autoFocus
                className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-[13px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[13px] font-medium shrink-0 transition-colors duration-150"
            >
              Lookup
            </button>
          </form>

          {auditSuccess && (
            <div className="p-3 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent)] text-[12px] text-[var(--accent)] font-medium">
              {auditSuccess}
            </div>
          )}

          {/* Active Item Card */}
          {activeItem ? (
            <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] space-y-4">
              <div className="flex items-start gap-4">
                <ItemImage
                  url={activeItem.resolvedImageUrl}
                  rawLink={activeItem.imageLink}
                  name={activeItem.simplified}
                  itemCategory={activeItem.item}
                  color={activeItem.color}
                  className="w-20 h-20 shrink-0 rounded-lg"
                />
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-[12px] font-medium text-[var(--text-muted)]">
                    {activeItem.sku}
                  </span>
                  <h3 className="text-[14px] font-medium text-[var(--text-primary)] mt-0.5 line-clamp-2">
                    {activeItem.simplified}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-[12px] text-[var(--text-muted)]">
                    <span>{activeItem.item}</span>
                    <span>•</span>
                    <span>{activeItem.color}</span>
                    <span>•</span>
                    <span>{activeItem.size}</span>
                  </div>
                </div>
              </div>

              {/* Physical Count Form */}
              <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] space-y-3">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[var(--text-primary)] font-medium">Physical stock count:</span>
                  <span className="text-[var(--text-muted)] font-mono">Recorded: {activeItem.stock}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setCountedQty((q) => Math.max(0, parseInt(q || '0', 10) - 1).toString())
                    }
                    className="p-2.5 rounded-lg bg-[var(--card-bg)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] border border-[var(--border)] transition-colors duration-150"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <input
                    type="number"
                    min="0"
                    value={countedQty}
                    onChange={(e) => setCountedQty(e.target.value)}
                    className="flex-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg py-2 text-center text-[20px] font-mono font-medium text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                  />

                  <button
                    onClick={() =>
                      setCountedQty((q) => (parseInt(q || '0', 10) + 1).toString())
                    }
                    className="p-2.5 rounded-lg bg-[var(--card-bg)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] border border-[var(--border)] transition-colors duration-150"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="pt-1">
                  <button
                    onClick={handleApplyCount}
                    className="w-full py-2.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[13px] font-medium flex items-center justify-center gap-2 transition-colors duration-150"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>Save physical count</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-[12px] text-[var(--text-muted)]">
              Type or scan an SKU above to start counting inventory on the warehouse floor.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--table-divider)] bg-[var(--card-bg)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[13px] font-medium transition-colors duration-150"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
