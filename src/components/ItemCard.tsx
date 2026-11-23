import React, { useState, useEffect } from 'react';
import { InventoryItem } from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
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
  const { updateStock, updateSimplified, quickAdjustStock, filters } = useInventory();

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

  const cardBorderClass = isOutOfStock
    ? 'border-rose-800/80 bg-rose-950/20'
    : isLowStock
    ? 'border-amber-800/80 bg-amber-950/20'
    : 'border-slate-700/80 bg-slate-800/90';

  const stockBadgeClass = isOutOfStock
    ? 'bg-rose-950/70 text-rose-300 border-rose-700/80'
    : isLowStock
    ? 'bg-amber-950/70 text-amber-300 border-amber-700/80'
    : 'bg-emerald-950/70 text-emerald-300 border-emerald-700/80';

  return (
    <div
      className={`group relative rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md ${cardBorderClass} ${
        justSaved ? 'ring-2 ring-emerald-400' : 'hover:border-slate-600'
      }`}
    >
      {/* Top Header Strip */}
      <div className="p-3.5 pb-2.5 flex items-start gap-3">
        {/* Clickable Image thumbnail */}
        <div className="shrink-0">
          <ItemImage
            url={item.resolvedImageUrl}
            rawLink={item.imageLink}
            name={item.simplified}
            itemCategory={item.item}
            color={item.color}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl"
            onClick={() => onOpenDetails(item)}
          />
        </div>

        {/* Product Details & Editable Title */}
        <div className="flex-1 min-w-0">
          {/* Category & Status badges */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-700/90 text-slate-200 border border-slate-600">
              {item.item || 'Article'}
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${stockBadgeClass}`}
            >
              {isOutOfStock ? '0 - Out of Stock' : isLowStock ? `Low: ${item.stock} left` : `${item.stock} In Stock`}
            </span>
          </div>

          {/* Simplified Name (Direct In-Place Editable with high contrast) */}
          {isEditingName ? (
            <div className="flex items-center gap-1 my-0.5">
              <input
                type="text"
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                autoFocus
                className="w-full bg-slate-900 border-2 border-indigo-500 rounded px-1.5 py-0.5 text-xs font-semibold text-white focus:outline-none shadow-xs"
              />
              <button
                onClick={handleNameSave}
                className="p-1 rounded bg-indigo-600 text-white hover:bg-indigo-500 shadow-xs"
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
              <h3 className="text-xs font-bold text-white group-hover/name:text-indigo-300 transition-colors line-clamp-2 leading-snug">
                {item.simplified}
              </h3>
              <Edit2 className="w-3 h-3 text-slate-400 group-hover/name:text-indigo-400 shrink-0 ml-1 opacity-0 group-hover/name:opacity-100 transition-opacity" />
            </div>
          )}

          {/* SKU Code */}
          <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5" title={item.sku}>
            SKU: <span className="text-indigo-300 font-semibold select-all">{item.sku}</span>
          </div>

          {/* Color & Size & MRP specs */}
          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-300 font-medium">
            {item.color && item.color !== 'Standard' && (
              <span className="truncate">{item.color}</span>
            )}
            {item.size && (
              <>
                <span className="text-slate-600">•</span>
                <span className="truncate text-slate-300">{item.size}</span>
              </>
            )}
            {item.mrp > 0 && (
              <>
                <span className="text-slate-600">•</span>
                <span className="font-bold text-white font-mono">₹{item.mrp}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Inventory Control & Steppers Bar */}
      <div className="p-3 py-2 bg-slate-900/80 border-t border-slate-700/80 flex items-center justify-between gap-2">
        {/* Stock Level Quick Editor */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            QTY:
          </span>
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
                className="w-16 bg-slate-950 border-2 border-indigo-500 rounded px-1.5 py-0.5 text-sm font-bold text-white text-center focus:outline-none shadow-xs"
              />
              <button
                onClick={handleStockSave}
                className="p-1 rounded bg-indigo-600 text-white hover:bg-indigo-500 shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingStock(true)}
              className={`px-2 py-0.5 rounded-lg border font-mono font-bold text-sm transition-all flex items-center gap-1 shadow-2xs hover:ring-2 hover:ring-indigo-500/30 ${
                isOutOfStock
                  ? 'bg-rose-950/60 text-rose-300 border-rose-700'
                  : isLowStock
                  ? 'bg-amber-950/60 text-amber-300 border-amber-700'
                  : 'bg-slate-800 text-white border-slate-600'
              }`}
              title="Click to type exact stock quantity"
            >
              <span>{item.stock}</span>
              <Edit2 className="w-2.5 h-2.5 text-slate-400 opacity-60" />
            </button>
          )}

          {/* Steppers (+1, +5, -1) */}
          <div className="flex items-center gap-0.5 ml-1">
            <button
              onClick={() => quickAdjustStock(item.id, -1)}
              disabled={item.stock <= 0}
              className="p-1 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-300 hover:text-white transition-colors"
              title="Decrease stock by 1"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              onClick={() => quickAdjustStock(item.id, 1)}
              className="p-1 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Increase stock by 1"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={() => quickAdjustStock(item.id, 5)}
              className="px-1.5 py-0.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-[10px] font-bold text-indigo-300 transition-colors border border-indigo-500/40"
              title="Add 5 units in batch"
            >
              +5
            </button>
          </div>
        </div>

        {/* History indicator button */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onOpenItemHistory(item)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition-colors border border-slate-700 shadow-2xs"
            title="View past 3 to 5 update logs"
          >
            <Clock className="w-3 h-3 text-sky-400" />
            <span>{item.history?.length || 1} logs</span>
          </button>
        </div>
      </div>
    </div>
  );
};
