import React, { useState, useEffect } from 'react';
import { InventoryItem } from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import { formatSalesPeriodLabel } from '../utils/csvHelper';
import { ItemImage } from './ItemImage';
import {
  Plus,
  Minus,
  Check,
  Edit2,
  Clock,
} from 'lucide-react';

interface ItemCardProps {
  item: InventoryItem;
  onOpenDetails: (item: InventoryItem) => void;
  onOpenItemHistory: (item: InventoryItem) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  onOpenDetails,
  onOpenItemHistory,
}) => {
  const { updateStock, updateSimplified, quickAdjustStock, filters, getItemSales } = useInventory();

  const periodSales = getItemSales(item.simplified, filters.salesPeriod);
  const periodLabel = formatSalesPeriodLabel(filters.salesPeriod);

  // Inline editing state for Simplified name
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(item.simplified);

  // Inline editing state for Stock level
  const [isEditingStock, setIsEditingStock] = useState(false);
  const [stockVal, setStockVal] = useState(item.stock.toString());
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setNameVal(item.simplified);
  }, [item.simplified]);

  useEffect(() => {
    setStockVal(item.stock.toString());
  }, [item.stock]);

  const handleNameSave = () => {
    if (nameVal.trim() && nameVal.trim() !== item.simplified) {
      updateSimplified(item.id, nameVal);
      triggerSavedFlash();
    }
    setIsEditingName(false);
  };

  const handleStockSave = () => {
    const parsed = parseInt(stockVal.trim(), 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed !== item.stock) {
      updateStock(item.id, parsed);
      triggerSavedFlash();
    } else {
      setStockVal(item.stock.toString());
    }
    setIsEditingStock(false);
  };

  const triggerSavedFlash = () => {
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  };

  // Stock status determination
  const isOutOfStock = item.stock === 0;
  const isLowStock = !isOutOfStock && item.stock <= filters.lowStockThreshold;

  const stockBadgeClass = isOutOfStock
    ? 'bg-[var(--status-out-bg)] text-[var(--status-out-text)]'
    : isLowStock
    ? 'bg-[var(--status-low-bg)] text-[var(--status-low-text)]'
    : 'bg-[var(--status-in-bg)] text-[var(--status-in-text)]';

  return (
    <div
      className={`group relative rounded-xl bg-[var(--card-bg)] border transition-colors duration-150 flex flex-col justify-between overflow-hidden ${
        justSaved ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]' : 'border-[var(--border)] hover:border-[#BFC4CC]'
      }`}
    >
      {/* Top Product Section */}
      <div className="p-4 pb-3 flex items-start gap-3">
        {/* Clickable Image thumbnail */}
        <div className="shrink-0">
          <ItemImage
            url={item.resolvedImageUrl}
            rawLink={item.imageLink}
            name={item.simplified}
            itemCategory={item.item}
            color={item.color}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg"
            onClick={() => onOpenDetails(item)}
          />
        </div>

        {/* Product Details & Editable Title */}
        <div className="flex-1 min-w-0">
          {/* Category & Status badges */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--surface-subtle)] text-[var(--text-muted)]">
              {item.item || 'Article'}
            </span>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${stockBadgeClass}`}>
              {isOutOfStock
                ? '0 - Out of Stock'
                : isLowStock
                ? `Low: ${item.stock} left`
                : `${item.stock} In Stock`}
            </span>
          </div>

          {/* Simplified Name (Direct In-Place Editable) */}
          {isEditingName ? (
            <div className="flex items-center gap-1 my-0.5">
              <input
                type="text"
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                autoFocus
                className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-2 py-1 text-[13px] font-medium text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
              />
              <button
                onClick={handleNameSave}
                className="p-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors duration-150"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => setIsEditingName(true)}
              className="group/name flex items-start justify-between cursor-pointer py-0.5"
              title="Click to edit simplified name"
            >
              <h3 className="text-[14px] font-medium text-[var(--text-primary)] group-hover/name:text-[var(--accent)] transition-colors duration-150 line-clamp-2 leading-snug">
                {item.simplified}
              </h3>
              <Edit2 className="w-3 h-3 text-[var(--text-muted)] shrink-0 ml-1.5 mt-1 opacity-0 group-hover/name:opacity-100 transition-opacity duration-150" />
            </div>
          )}

          {/* SKU Code */}
          <div className="text-[12px] font-mono text-[var(--text-muted)] truncate mt-1" title={item.sku}>
            SKU: <span className="select-all">{item.sku}</span>
          </div>

          {/* Color, Size, MRP & Sales specs */}
          <div className="flex items-center gap-1.5 mt-1 text-[12px] text-[var(--text-muted)] flex-wrap">
            {item.color && item.color !== 'Standard' && (
              <span className="truncate">{item.color}</span>
            )}
            {item.size && (
              <>
                {item.color && item.color !== 'Standard' && <span>•</span>}
                <span className="truncate">{item.size}</span>
              </>
            )}
            {item.mrp > 0 && (
              <>
                {(item.size || (item.color && item.color !== 'Standard')) && <span>•</span>}
                <span className="font-medium text-[var(--text-primary)] font-mono">
                  ₹{item.mrp}
                </span>
              </>
            )}
          </div>

          {/* Sales for active period */}
          <div className="mt-1.5 text-[12px] text-[var(--text-muted)] flex items-center gap-1.5">
            <span>Sales ({periodLabel}):</span>
            <span className="font-mono font-medium text-[var(--text-primary)]">
              {periodSales.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Inventory Control & Steppers Bar */}
      <div className="px-4 py-3 bg-[var(--card-bg)] border-t border-[var(--table-divider)] flex items-center justify-between gap-2">
        {/* Stock Level Quick Editor */}
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-normal text-[var(--text-muted)]">Qty:</span>
          {isEditingStock ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                value={stockVal}
                onChange={(e) => setStockVal(e.target.value)}
                onBlur={handleStockSave}
                onKeyDown={(e) => e.key === 'Enter' && handleStockSave()}
                autoFocus
                className="w-16 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-1.5 py-1 text-[13px] font-medium text-[var(--text-primary)] text-center font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
              />
              <button
                onClick={handleStockSave}
                className="p-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors duration-150"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingStock(true)}
              className="px-2.5 py-1 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] font-mono font-medium text-[13px] transition-colors duration-150 flex items-center gap-1.5"
              title="Click to type exact stock quantity"
            >
              <span>{item.stock}</span>
              <Edit2 className="w-3 h-3 text-[var(--text-muted)]" />
            </button>
          )}

          {/* Steppers (-1, +1, +5) */}
          <div className="flex items-center gap-1 ml-0.5">
            <button
              onClick={() => quickAdjustStock(item.id, -1)}
              disabled={item.stock <= 0}
              className="p-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] disabled:opacity-35 disabled:pointer-events-none text-[var(--text-primary)] transition-colors duration-150"
              title="Decrease stock by 1"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              onClick={() => quickAdjustStock(item.id, 1)}
              className="p-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] transition-colors duration-150"
              title="Increase stock by 1"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={() => quickAdjustStock(item.id, 5)}
              className="px-2 py-1 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[12px] font-medium text-[var(--text-primary)] transition-colors duration-150"
              title="Add 5 units in batch"
            >
              +5
            </button>
          </div>
        </div>

        {/* History indicator button */}
        <button
          onClick={() => onOpenItemHistory(item)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--card-bg)] hover:bg-[var(--table-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[12px] font-normal transition-colors duration-150 border border-[var(--border)]"
          title="View past 3 to 5 update logs"
        >
          <Clock className="w-3 h-3 text-[var(--text-muted)]" />
          <span>{item.history?.length || 1} logs</span>
        </button>
      </div>
    </div>
  );
};
