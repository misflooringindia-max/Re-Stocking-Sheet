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
  PackageCheck
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
      setAuditSuccess(`Saved! ${activeItem.sku} stock updated to ${parsed}`);
      // Refresh active item
      setActiveItem((prev) => (prev ? { ...prev, stock: parsed } : null));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-700/80 bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                Rapid Warehouse Cycle Count & Audit Mode
              </h2>
              <p className="text-xs text-slate-400">
                Scan or type SKU / ASIN / EAN to audit and update stock in seconds
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

        {/* Input Bar */}
        <div className="p-4 sm:p-5 space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Scan Barcode or type SKU (e.g. 3D_Mat_Leaf_Green)..."
                autoFocus
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-slate-400 focus:bg-slate-800 focus:outline-none focus:border-indigo-500 shadow-xs"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0 transition-colors shadow-xs"
            >
              Lookup
            </button>
          </form>

          {auditSuccess && (
            <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-xs text-indigo-300 font-semibold">
              {auditSuccess}
            </div>
          )}

          {/* Active Item Card */}
          {activeItem ? (
            <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 space-y-4">
              <div className="flex items-start gap-4">
                <ItemImage
                  url={activeItem.resolvedImageUrl}
                  rawLink={activeItem.imageLink}
                  name={activeItem.simplified}
                  itemCategory={activeItem.item}
                  color={activeItem.color}
                  className="w-20 h-20 shrink-0 rounded-xl shadow-xs"
                />
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-xs font-bold text-indigo-300">
                    {activeItem.sku}
                  </span>
                  <h3 className="text-sm font-bold text-white mt-0.5 line-clamp-2">
                    {activeItem.simplified}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-300 font-medium">
                    <span>{activeItem.item}</span>
                    <span>•</span>
                    <span>{activeItem.color}</span>
                    <span>•</span>
                    <span>{activeItem.size}</span>
                  </div>
                </div>
              </div>

              {/* Physical Count Form */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 space-y-3 shadow-xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-bold">Physical Stock Count:</span>
                  <span className="text-slate-400 font-mono">Recorded: {activeItem.stock}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setCountedQty((q) => Math.max(0, parseInt(q || '0', 10) - 1).toString())
                    }
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <input
                    type="number"
                    min="0"
                    value={countedQty}
                    onChange={(e) => setCountedQty(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl py-2 text-center text-xl font-mono font-extrabold text-white focus:outline-none focus:border-indigo-500"
                  />

                  <button
                    onClick={() =>
                      setCountedQty((q) => (parseInt(q || '0', 10) + 1).toString())
                    }
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={handleApplyCount}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>Save Physical Count</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-slate-400">
              Type or scan an SKU above to start counting inventory on the warehouse floor.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-700/80 bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
