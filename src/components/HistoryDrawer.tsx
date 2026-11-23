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
    <div className="fixed inset-0 z-50 flex justify-end bg-[var(--overlay-bg)]">
      <div className="w-full max-w-lg bg-[var(--card-bg)] border-l border-[var(--border)] h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[var(--table-divider)] flex items-center justify-between bg-[var(--card-bg)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[var(--surface-subtle)] text-[var(--text-muted)] border border-[var(--border)]">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[14px] font-medium text-[var(--text-primary)]">
                Audit update history
              </h2>
              <p className="text-[12px] text-[var(--text-muted)]">
                Tracking past updates with date &amp; time stamps
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

        {/* Tab Selection */}
        <div className="flex border-b border-[var(--table-divider)] bg-[var(--table-header-bg)] px-4 pt-2 gap-1">
          {selectedItem && (
            <button
              onClick={() => setTab('item')}
              className={`pb-2.5 px-3 text-[12px] border-b-2 transition-colors duration-150 ${
                tab === 'item'
                  ? 'border-[var(--accent)] text-[var(--accent)] font-medium'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] font-normal'
              }`}
            >
              Current article ({selectedItem.sku.slice(0, 16)})
            </button>
          )}
          <button
            onClick={() => setTab('global')}
            className={`pb-2.5 px-3 text-[12px] border-b-2 transition-colors duration-150 ${
              tab === 'global' || !selectedItem
                ? 'border-[var(--accent)] text-[var(--accent)] font-medium'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] font-normal'
            }`}
          >
            All catalogue updates ({globalHistory.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === 'item' && selectedItem ? (
            <div className="space-y-4">
              {/* Item Info Box */}
              <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-mono text-[var(--text-muted)]">
                    {selectedItem.sku}
                  </div>
                  <h3 className="text-[14px] font-medium text-[var(--text-primary)] mt-0.5 line-clamp-2">
                    {selectedItem.simplified}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5 text-[12px] text-[var(--text-muted)]">
                    <span>
                      Current stock:{' '}
                      <span
                        className={`font-mono font-medium ${
                          selectedItem.stock === 0
                            ? 'text-[var(--status-out-text)]'
                            : selectedItem.stock <= 15
                            ? 'text-[var(--status-low-text)]'
                            : 'text-[var(--status-in-text)]'
                        }`}
                      >
                        {selectedItem.stock} units
                      </span>
                    </span>
                    <span>•</span>
                    <span className="font-mono text-[var(--text-primary)] font-medium">
                      ₹{selectedItem.mrp}
                    </span>
                  </div>
                </div>
              </div>

              {/* Timeline of past 3 to 5 updates */}
              <div className="space-y-3">
                <div className="text-[12px] font-medium text-[var(--text-muted)] flex items-center justify-between">
                  <span>Past 3 to 5 update records</span>
                  <span className="text-[12px] text-[var(--text-muted)] font-normal">
                    {itemHistory.length} recorded
                  </span>
                </div>

                {itemHistory.length === 0 ? (
                  <div className="text-center py-8 text-[12px] text-[var(--text-muted)]">
                    No recorded edits yet. Any change to stock or simplified name will be logged
                    here instantly.
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-[var(--border)]">
                    {itemHistory.map((h, idx) => {
                      const dt = formatDate(h.timestamp);
                      return (
                        <div key={h.id || idx} className="relative">
                          {/* Dot marker */}
                          <div className="absolute -left-[19px] top-3 w-2.5 h-2.5 rounded-full bg-[var(--card-bg)] border-2 border-[var(--accent)]" />

                          {/* Log card */}
                          <div className="p-3.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border)]">
                            <div className="flex items-center justify-between text-[12px] text-[var(--text-muted)] mb-1.5">
                              <span className="font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                {dt.date}
                              </span>
                              <span className="font-mono text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                                <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                                {dt.time}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[12px]">
                              <span className="px-1.5 py-0.5 rounded bg-[var(--surface-subtle)] text-[11px] font-medium text-[var(--text-muted)] border border-[var(--border)]">
                                {h.field}
                              </span>
                              <span className="font-mono line-through text-[var(--text-muted)]">
                                {String(h.oldValue)}
                              </span>
                              <ArrowRight className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                              <span className="font-mono font-medium text-[var(--text-primary)]">
                                {String(h.newValue)}
                              </span>
                            </div>

                            {h.changeNote && (
                              <div className="mt-2 text-[12px] text-[var(--text-muted)] bg-[var(--surface-subtle)] border border-[var(--border)] rounded-lg px-2.5 py-1.5">
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
              <h4 className="text-[12px] font-medium text-[var(--text-muted)]">
                Recent master record edits across catalogue
              </h4>

              {globalHistory.length === 0 ? (
                <div className="text-center py-8 text-[12px] text-[var(--text-muted)]">
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
                        className="p-3.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] hover:border-[var(--accent)] cursor-pointer transition-colors duration-150"
                      >
                        <div className="flex items-center justify-between text-[12px] mb-1">
                          <span className="font-mono text-[var(--text-muted)] font-medium">
                            {h.sku}
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)] font-mono">
                            {dt.date} {dt.time}
                          </span>
                        </div>
                        <div className="text-[13px] font-medium text-[var(--text-primary)] line-clamp-1">
                          {h.simplified}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[12px]">
                            <span className="px-1.5 py-0.5 rounded bg-[var(--surface-subtle)] text-[11px] font-medium text-[var(--text-muted)] border border-[var(--border)]">
                              {h.field}
                            </span>
                            <span className="font-mono text-[var(--text-muted)]">
                              {String(h.oldValue)}
                            </span>
                            <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                            <span className="font-mono font-medium text-[var(--text-primary)]">
                              {String(h.newValue)}
                            </span>
                          </div>
                          {h.changeNote && (
                            <span className="text-[11px] text-[var(--text-muted)] truncate max-w-[160px]">
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
        <div className="p-4 border-t border-[var(--table-divider)] bg-[var(--card-bg)] flex items-center justify-between text-[12px] text-[var(--text-muted)]">
          <span>All updates automatically persisted locally</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] font-medium transition-colors duration-150"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
