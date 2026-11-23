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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[var(--overlay-bg)]">
      <div className="w-full max-w-2xl bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-[var(--table-divider)] flex items-center justify-between bg-[var(--card-bg)]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[12px] font-medium text-[var(--text-muted)] bg-[var(--surface-subtle)] px-2 py-0.5 rounded-lg border border-[var(--border)]">
              {item.sku}
            </span>
            <span
              className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                isOutOfStock
                  ? 'bg-[var(--status-out-bg)] text-[var(--status-out-text)]'
                  : isLowStock
                  ? 'bg-[var(--status-low-bg)] text-[var(--status-low-text)]'
                  : 'bg-[var(--status-in-bg)] text-[var(--status-in-text)]'
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
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--table-hover)] transition-colors duration-150"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Top section: Image + Master Info */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Image Preview */}
            <div className="w-36 h-36 sm:w-44 sm:h-44 shrink-0 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--surface-subtle)] flex items-center justify-center relative">
              <ItemImage
                url={item.resolvedImageUrl}
                rawLink={item.imageLink}
                name={item.simplified}
                itemCategory={item.item}
                color={item.color}
                className="w-full h-full border-0"
              />
              {item.imageLink && (
                <a
                  href={item.imageLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-[var(--card-bg)] hover:bg-[var(--table-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border)] transition-colors duration-150"
                  title="Open original image link in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {/* Editable Title & Metadata */}
            <div className="flex-1 w-full space-y-3">
              <div>
                <span className="text-[12px] font-normal text-[var(--text-muted)]">
                  Simplified article name (master record)
                </span>
                {isEditingName ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      type="text"
                      value={nameVal}
                      onChange={(e) => setNameVal(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                      className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[14px] font-normal text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                      autoFocus
                    />
                    <button
                      onClick={handleNameSave}
                      className="px-3.5 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-[13px] flex items-center gap-1 transition-colors duration-150"
                    >
                      <Check className="w-4 h-4" />
                      <span>Save</span>
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => setIsEditingName(true)}
                    className="group cursor-pointer flex items-start justify-between p-2 -mx-2 rounded-lg hover:bg-[var(--table-hover)] transition-colors duration-150"
                  >
                    <h2 className="text-[16px] font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] leading-snug">
                      {item.simplified}
                    </h2>
                    <Edit3 className="w-4 h-4 text-[var(--text-muted)] shrink-0 ml-2 mt-0.5" />
                  </div>
                )}
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[12px]">
                <div className="p-2.5 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border)]">
                  <span className="text-[var(--text-muted)] block text-[11px]">Category</span>
                  <span className="font-medium text-[var(--text-primary)] mt-0.5 block truncate">
                    {item.item}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border)]">
                  <span className="text-[var(--text-muted)] block text-[11px]">Color</span>
                  <span className="font-medium text-[var(--text-primary)] mt-0.5 block truncate">
                    {item.color}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border)]">
                  <span className="text-[var(--text-muted)] block text-[11px]">Size</span>
                  <span className="font-medium text-[var(--text-primary)] mt-0.5 block truncate">
                    {item.size}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border)]">
                  <span className="text-[var(--text-muted)] block text-[11px]">MRP</span>
                  <span className="font-medium text-[var(--text-primary)] mt-0.5 block font-mono text-[13px]">
                    {item.mrp > 0 ? `₹${item.mrp}` : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Marketplace Codes */}
              <div className="flex flex-wrap items-center gap-3 text-[12px] text-[var(--text-muted)]">
                {item.asin && item.asin !== 'NO DATA' && (
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-[var(--text-muted)] font-sans">ASIN:</span>
                    <span className="text-[var(--text-primary)] font-medium select-all bg-[var(--surface-subtle)] px-2 py-0.5 rounded-lg border border-[var(--border)]">
                      {item.asin}
                    </span>
                  </div>
                )}
                {item.ean && item.ean !== 'NO DATA' && (
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-[var(--text-muted)] font-sans">EAN:</span>
                    <span className="text-[var(--text-primary)] font-medium select-all bg-[var(--surface-subtle)] px-2 py-0.5 rounded-lg border border-[var(--border)]">
                      {item.ean}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Real-time Inventory Stock Control Box */}
          <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[var(--text-muted)]" />
                <span>Live stock level control</span>
              </span>
              <span className="text-[12px] text-[var(--text-muted)]">
                Low-stock threshold: ≤ {filters.lowStockThreshold}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Direct Stock Input */}
              <div className="flex items-center gap-2 bg-[var(--card-bg)] px-3 py-1.5 rounded-lg border border-[var(--border)]">
                <span className="text-[12px] font-normal text-[var(--text-muted)]">Current qty:</span>
                <input
                  type="number"
                  min="0"
                  value={stockVal}
                  onChange={(e) => setStockVal(e.target.value)}
                  onBlur={() => handleStockSave()}
                  onKeyDown={(e) => e.key === 'Enter' && handleStockSave()}
                  className="w-20 bg-transparent text-center font-mono font-medium text-[16px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] rounded"
                />
                <button
                  onClick={() => handleStockSave()}
                  className="px-3 py-1 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[12px] font-medium text-white transition-colors duration-150"
                >
                  Update
                </button>
              </div>

              {/* Quick Stepper Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => handleStockSave(Math.max(0, item.stock - 1))}
                  className="px-3 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[12px] font-medium text-[var(--text-primary)] transition-colors duration-150"
                >
                  -1
                </button>
                <button
                  onClick={() => handleStockSave(item.stock + 1)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[12px] font-medium text-[var(--text-primary)] transition-colors duration-150"
                >
                  +1
                </button>
                <button
                  onClick={() => handleStockSave(item.stock + 10)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[12px] font-medium text-[var(--text-primary)] transition-colors duration-150"
                >
                  +10 Restock
                </button>
                <button
                  onClick={() => handleStockSave(item.stock + 50)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[12px] font-medium text-[var(--text-primary)] transition-colors duration-150"
                >
                  +50 Restock
                </button>
                <button
                  onClick={() => handleStockSave(0)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[12px] font-medium text-[var(--text-primary)] transition-colors duration-150"
                >
                  Set 0
                </button>
              </div>
            </div>
          </div>

          {/* Past 3 to 5 Updates Timeline Section */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="text-[12px] font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>History (past 3 to 5 updates)</span>
              </h4>
              <button
                onClick={() => onOpenHistory(item)}
                className="text-[12px] text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium transition-colors duration-150"
              >
                Full audit drawer →
              </button>
            </div>

            <div className="divide-y divide-[var(--table-divider)] rounded-xl bg-[var(--card-bg)] border border-[var(--border)] overflow-hidden">
              {(item.history || []).slice(0, 5).map((h, i) => {
                const dt = formatDate(h.timestamp);
                return (
                  <div key={h.id || i} className="p-3 flex items-center justify-between gap-3 text-[12px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded bg-[var(--surface-subtle)] text-[11px] font-medium text-[var(--text-muted)] border border-[var(--border)]">
                        {h.field}
                      </span>
                      <span className="font-mono text-[var(--text-muted)] line-through">
                        {String(h.oldValue)}
                      </span>
                      <ArrowRight className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                      <span className="font-mono font-medium text-[var(--text-primary)]">
                        {String(h.newValue)}
                      </span>
                      {h.changeNote && (
                        <span className="text-[12px] text-[var(--text-muted)] hidden sm:inline ml-1 truncate">
                          ({h.changeNote})
                        </span>
                      )}
                    </div>
                    <div className="text-right text-[11px] text-[var(--text-muted)] font-mono shrink-0">
                      <div className="font-medium text-[var(--text-primary)]">{dt.date}</div>
                      <div>{dt.time}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--table-divider)] bg-[var(--card-bg)] flex items-center justify-between">
          <div className="text-[12px] text-[var(--text-muted)]">
            Last modified:{' '}
            <span className="text-[var(--text-primary)] font-mono font-medium">
              {new Date(item.updatedAt).toLocaleTimeString()}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] font-medium text-[13px] transition-colors duration-150"
          >
            Close details
          </button>
        </div>
      </div>
    </div>
  );
};
