import React, { useState } from 'react';
import { InventoryItem } from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import { ItemImage } from './ItemImage';
import {
  X,
  Edit3,
  Check,
  Clock,
  ExternalLink,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface ItemDetailModalProps {
  item: InventoryItem | null;
  onClose: () => void;
  onOpenHistory: (item: InventoryItem) => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  onClose,
  onOpenHistory,
}) => {
  const { updateStock, updateSimplified, filters } = useInventory();

  if (!item) return null;

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(item.simplified);

  const [isEditingStock, setIsEditingStock] = useState(false);
  const [stockVal, setStockVal] = useState(item.stock.toString());

  const handleNameSave = () => {
    if (nameVal.trim() && nameVal.trim() !== item.simplified) {
      updateSimplified(item.id, nameVal);
    }
    setIsEditingName(false);
  };

  const handleStockSave = (customNum?: number) => {
    const val = customNum !== undefined ? customNum : parseInt(stockVal.trim(), 10);
    if (!isNaN(val) && val >= 0) {
      updateStock(item.id, val);
      setStockVal(val.toString());
    }
    setIsEditingStock(false);
  };

  const isOutOfStock = item.stock === 0;
  const isLowStock = !isOutOfStock && item.stock <= filters.lowStockThreshold;

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return {
        date: d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        time: d.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
    } catch {
      return { date: isoString, time: '' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/80 flex items-center justify-between bg-slate-850 bg-slate-900">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-lg border border-indigo-500/30">
              {item.sku}
            </span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                isOutOfStock
                  ? 'bg-rose-950/70 text-rose-300 border-rose-700'
                  : isLowStock
                  ? 'bg-amber-950/70 text-amber-300 border-amber-700'
                  : 'bg-emerald-950/70 text-emerald-300 border-emerald-700'
              }`}
            >
              {isOutOfStock
                ? 'Out of Stock (0)'
                : isLowStock
                ? `Low Stock (${item.stock} left)`
                : `In Stock (${item.stock})`}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Top section: High-Res Image + Master Info */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Enlarged Image Preview */}
            <div className="w-36 h-36 sm:w-44 sm:h-44 shrink-0 rounded-2xl overflow-hidden border border-slate-700 bg-slate-800 shadow-inner flex items-center justify-center relative">
              <ItemImage
                url={item.resolvedImageUrl}
                rawLink={item.imageLink}
                name={item.simplified}
                itemCategory={item.item}
                color={item.color}
                className="w-full h-full"
              />
              {item.imageLink && (
                <a
                  href={item.imageLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-900 text-slate-200 hover:text-white text-xs flex items-center gap-1 shadow-md border border-slate-700"
                  title="Open original image link in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {/* Editable Title & Metadata */}
            <div className="flex-1 w-full space-y-3">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Simplified Article Name (Master Record)
                </span>
                {isEditingName ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      type="text"
                      value={nameVal}
                      onChange={(e) => setNameVal(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                      className="w-full bg-slate-950 border-2 border-indigo-500 rounded-xl px-3 py-1.5 text-sm font-semibold text-white focus:outline-none shadow-xs"
                      autoFocus
                    />
                    <button
                      onClick={handleNameSave}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1 shadow-xs"
                    >
                      <Check className="w-4 h-4" />
                      Save
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => setIsEditingName(true)}
                    className="group cursor-pointer flex items-start justify-between p-2 -mx-2 rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    <h2 className="text-base font-extrabold text-white group-hover:text-indigo-300 leading-snug">
                      {item.simplified}
                    </h2>
                    <Edit3 className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 shrink-0 ml-2 mt-0.5" />
                  </div>
                )}
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Category</span>
                  <span className="font-bold text-slate-200 mt-0.5 block truncate">
                    {item.item}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Color</span>
                  <span className="font-bold text-slate-200 mt-0.5 block truncate">
                    {item.color}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Size</span>
                  <span className="font-bold text-slate-200 mt-0.5 block truncate">
                    {item.size}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700/80">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">MRP</span>
                  <span className="font-bold text-emerald-400 mt-0.5 block font-mono text-sm">
                    {item.mrp > 0 ? `₹${item.mrp}` : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Marketplace Codes */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                {item.asin && item.asin !== 'NO DATA' && (
                  <div className="flex items-center gap-1 font-mono">
                    <span className="text-slate-400 font-sans">ASIN:</span>
                    <span className="text-indigo-300 font-bold select-all bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                      {item.asin}
                    </span>
                  </div>
                )}
                {item.ean && item.ean !== 'NO DATA' && (
                  <div className="flex items-center gap-1 font-mono">
                    <span className="text-slate-400 font-sans">EAN:</span>
                    <span className="text-indigo-300 font-bold select-all bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                      {item.ean}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Real-time Inventory Stock Control Box */}
          <div className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-400" />
                Live Stock Level Control
              </span>
              <span className="text-xs text-slate-400">
                Low-Stock Threshold: ≤ {filters.lowStockThreshold}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Direct Stock Input */}
              <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700 shadow-xs">
                <span className="text-xs font-bold text-slate-400">Current Qty:</span>
                <input
                  type="number"
                  min="0"
                  value={stockVal}
                  onChange={(e) => setStockVal(e.target.value)}
                  onBlur={() => handleStockSave()}
                  onKeyDown={(e) => e.key === 'Enter' && handleStockSave()}
                  className="w-20 bg-transparent text-center font-mono font-extrabold text-lg text-white focus:outline-none"
                />
                <button
                  onClick={() => handleStockSave()}
                  className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-xs"
                >
                  Update
                </button>
              </div>

              {/* Quick Stepper Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => handleStockSave(Math.max(0, item.stock - 1))}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-slate-200 shadow-2xs"
                >
                  -1
                </button>
                <button
                  onClick={() => handleStockSave(item.stock + 1)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-slate-200 shadow-2xs"
                >
                  +1
                </button>
                <button
                  onClick={() => handleStockSave(item.stock + 10)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-xs font-bold text-indigo-300 border border-indigo-500/40 shadow-2xs"
                >
                  +10 Restock
                </button>
                <button
                  onClick={() => handleStockSave(item.stock + 50)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-xs font-bold text-indigo-300 border border-indigo-500/40 shadow-2xs"
                >
                  +50 Restock
                </button>
                <button
                  onClick={() => handleStockSave(0)}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-xs font-bold text-rose-300 border border-rose-800 shadow-2xs"
                >
                  Set 0 (Out)
                </button>
              </div>
            </div>
          </div>

          {/* Past 3 to 5 Updates Timeline Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                History (Past 3 to 5 Updates with Date & Time)
              </h4>
              <button
                onClick={() => onOpenHistory(item)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-bold"
              >
                Full Audit Drawer →
              </button>
            </div>

            <div className="divide-y divide-slate-700/60 rounded-2xl bg-slate-800/90 border border-slate-700 overflow-hidden shadow-xs">
              {(item.history || []).slice(0, 5).map((h, i) => {
                const dt = formatDate(h.timestamp);
                return (
                  <div key={h.id || i} className="p-3 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-slate-700 text-[10px] font-bold text-slate-300 uppercase border border-slate-600">
                        {h.field}
                      </span>
                      <span className="font-mono text-slate-400 line-through">
                        {String(h.oldValue)}
                      </span>
                      <ArrowRight className="w-3 h-3 text-indigo-400" />
                      <span className="font-mono font-bold text-emerald-400">
                        {String(h.newValue)}
                      </span>
                      {h.changeNote && (
                        <span className="text-[11px] text-slate-400 hidden sm:inline ml-2">
                          ({h.changeNote})
                        </span>
                      )}
                    </div>
                    <div className="text-right text-[11px] text-slate-400 font-mono shrink-0">
                      <div className="font-medium text-slate-300">{dt.date}</div>
                      <div className="text-[10px] text-slate-500">{dt.time}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700/80 bg-slate-900 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Last modified:{' '}
            <span className="text-slate-200 font-mono font-semibold">
              {new Date(item.updatedAt).toLocaleTimeString()}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors shadow-xs"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
