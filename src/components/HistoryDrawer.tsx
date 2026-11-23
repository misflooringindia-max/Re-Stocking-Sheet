import React, { useState } from 'react';
import { InventoryItem } from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import { 
  X, 
  Clock, 
  ArrowRight, 
  History, 
  Calendar,
} from 'lucide-react';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItem: InventoryItem | null;
  onSelectItem: (item: InventoryItem | null) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  selectedItem,
  onSelectItem,
}) => {
  const { globalHistory, items } = useInventory();
  const [tab, setTab] = useState<'item' | 'global'>('item');

  if (!isOpen) return null;

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
          second: '2-digit',
        }),
      };
    } catch {
      return { date: isoString, time: '' };
    }
  };

  const itemHistory = selectedItem?.history || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-lg bg-slate-900 border-l border-slate-700/80 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/80 flex items-center justify-between bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                Audit Update History
              </h2>
              <p className="text-xs text-slate-400">
                Tracking past updates with date & time stamps
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 pt-2">
          {selectedItem && (
            <button
              onClick={() => setTab('item')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all ${
                tab === 'item'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Current Article ({selectedItem.sku.slice(0, 16)})
            </button>
          )}
          <button
            onClick={() => setTab('global')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all ${
              tab === 'global' || !selectedItem
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            All Catalogue Updates ({globalHistory.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === 'item' && selectedItem ? (
            <div className="space-y-4">
              {/* Item Info Box */}
              <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-mono text-indigo-300 font-bold">
                    {selectedItem.sku}
                  </div>
                  <h3 className="text-xs font-bold text-white mt-0.5 line-clamp-2">
                    {selectedItem.simplified}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-300">
                    <span>
                      Current Stock:{' '}
                      <strong
                        className={`font-mono ${
                          selectedItem.stock === 0
                            ? 'text-rose-400'
                            : selectedItem.stock <= 15
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {selectedItem.stock} units
                      </strong>
                    </span>
                    <span>•</span>
                    <span>₹{selectedItem.mrp}</span>
                  </div>
                </div>
              </div>

              {/* Timeline of past 3 to 5 updates */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Past 3 to 5 Update Records</span>
                  <span className="text-[11px] text-indigo-400 font-semibold lowercase">
                    {itemHistory.length} recorded
                  </span>
                </h4>

                {itemHistory.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500">
                    No recorded edits yet. Any change to Stock or Simplified name will be logged
                    here instantly.
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-3.5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-700">
                    {itemHistory.map((h, idx) => {
                      const dt = formatDate(h.timestamp);
                      return (
                        <div key={h.id || idx} className="relative group">
                          {/* Dot marker */}
                          <div className="absolute -left-6 top-2 w-3 h-3 rounded-full bg-slate-900 border-2 border-indigo-500 group-hover:scale-125 transition-transform" />

                          {/* Log card */}
                          <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 transition-colors shadow-2xs">
                            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                              <span className="font-bold text-white flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                                {dt.date}
                              </span>
                              <span className="font-mono text-[11px] text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-500" />
                                {dt.time}
                              </span>
                            </div>

                            <div className="mt-1.5 flex items-center gap-2 text-xs">
                              <span className="px-1.5 py-0.5 rounded bg-slate-700 text-[10px] font-bold text-slate-200 uppercase border border-slate-600">
                                {h.field}
                              </span>
                              <span className="font-mono line-through text-slate-400">
                                {String(h.oldValue)}
                              </span>
                              <ArrowRight className="w-3 h-3 text-indigo-400 shrink-0" />
                              <span className="font-mono font-bold text-emerald-400">
                                {String(h.newValue)}
                              </span>
                            </div>

                            {h.changeNote && (
                              <div className="mt-2 text-[11px] text-slate-300 bg-slate-900/80 border border-slate-750 border-slate-700 rounded-md px-2 py-1">
                                {h.changeNote}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Global Catalogue Timeline */
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Recent Master Record Edits Across Catalogue
              </h4>

              {globalHistory.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No inventory edits have been performed yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {globalHistory.map((h, i) => {
                    const dt = formatDate(h.timestamp);
                    const matched = items.find((it) => it.id === h.itemId);

                    return (
                      <div
                        key={h.id || i}
                        onClick={() => matched && onSelectItem(matched)}
                        className="p-3 rounded-xl bg-slate-800 border border-slate-700 hover:border-indigo-500 cursor-pointer transition-all shadow-2xs group"
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-mono text-indigo-300 font-bold group-hover:text-indigo-200">
                            {h.sku}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {dt.date} {dt.time}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-white line-clamp-1">{h.simplified}</div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="px-1.5 py-0.5 rounded bg-slate-700 text-[10px] font-bold text-slate-300 uppercase border border-slate-600">
                              {h.field}
                            </span>
                            <span className="font-mono text-slate-400">{String(h.oldValue)}</span>
                            <ArrowRight className="w-3 h-3 text-slate-500" />
                            <span className="font-mono font-bold text-emerald-400">
                              {String(h.newValue)}
                            </span>
                          </div>
                          {h.changeNote && (
                            <span className="text-[11px] text-slate-400 truncate max-w-[150px]">
                              {h.changeNote}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-700/80 bg-slate-900 flex items-center justify-between text-xs text-slate-400">
          <span>All updates automatically persisted to local storage</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
