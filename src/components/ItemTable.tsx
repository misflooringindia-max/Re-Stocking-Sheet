import React, { useState } from 'react';
import { InventoryItem } from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import { ItemImage } from './ItemImage';
import {
  Plus,
  Minus,
  Edit2,
  Check,
  Clock,
  ArrowUpDown,
} from 'lucide-react';

interface ItemTableProps {
  items: InventoryItem[];
  onOpenDetails: (item: InventoryItem) => void;
  onOpenItemHistory: (item: InventoryItem) => void;
}

export const ItemTable: React.FC<ItemTableProps> = ({
  items,
  onOpenDetails,
  onOpenItemHistory,
}) => {
  const { updateStock, updateSimplified, quickAdjustStock, filters, setFilters } =
    useInventory();

  // Active inline editing cell tracking
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'stock' | 'simplified' | null>(null);
  const [editVal, setEditVal] = useState('');

  const startEdit = (id: string, field: 'stock' | 'simplified', initialVal: string) => {
    setEditingId(id);
    setEditingField(field);
    setEditVal(initialVal);
  };

  const saveEdit = (item: InventoryItem) => {
    if (!editingId || !editingField) return;

    if (editingField === 'simplified') {
      const trimmed = editVal.trim();
      if (trimmed && trimmed !== item.simplified) {
        updateSimplified(item.id, trimmed);
      }
    } else if (editingField === 'stock') {
      const parsed = parseInt(editVal.trim(), 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed !== item.stock) {
        updateStock(item.id, parsed);
      }
    }

    setEditingId(null);
    setEditingField(null);
  };

  const handleSort = (field: 'sku' | 'simplified' | 'stock' | 'mrp') => {
    setFilters((p) => {
      let nextSort: any = 'stock-asc';
      if (field === 'stock') {
        nextSort = p.sortBy === 'stock-asc' ? 'stock-desc' : 'stock-asc';
      } else if (field === 'simplified') {
        nextSort = 'simplified';
      } else if (field === 'sku') {
        nextSort = 'sku';
      } else if (field === 'mrp') {
        nextSort = 'mrp-desc';
      }
      return { ...p, sortBy: nextSort };
    });
  };

  return (
    <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-700 text-[11px] font-bold text-slate-300 uppercase tracking-wider select-none">
              <th className="py-3 px-3 w-14 text-center">Image</th>
              <th
                onClick={() => handleSort('sku')}
                className="py-3 px-3 cursor-pointer hover:text-indigo-300 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Uniware SKU</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('simplified')}
                className="py-3 px-3 cursor-pointer hover:text-indigo-300 transition-colors min-w-[220px]"
              >
                <div className="flex items-center gap-1">
                  <span>Simplified Article Name (Edit)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-2">Item Category</th>
              <th className="py-3 px-2">Color</th>
              <th className="py-3 px-2">Size</th>
              <th
                onClick={() => handleSort('stock')}
                className="py-3 px-3 cursor-pointer hover:text-indigo-300 transition-colors min-w-[170px]"
              >
                <div className="flex items-center gap-1">
                  <span>Stock / Qty</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('mrp')}
                className="py-3 px-2 cursor-pointer hover:text-indigo-300 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>MRP</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-3">ASIN / EAN</th>
              <th className="py-3 px-3 text-right">Audit History</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60 font-medium text-slate-200">
            {items.map((item) => {
              const isOutOfStock = item.stock === 0;
              const isLowStock = !isOutOfStock && item.stock <= filters.lowStockThreshold;

              const isEditingThisName = editingId === item.id && editingField === 'simplified';
              const isEditingThisStock = editingId === item.id && editingField === 'stock';

              return (
                <tr
                  key={item.id}
                  className={`hover:bg-slate-700/40 transition-colors group ${
                    isOutOfStock
                      ? 'bg-rose-950/20'
                      : isLowStock
                      ? 'bg-amber-950/20'
                      : ''
                  }`}
                >
                  {/* Image Column */}
                  <td className="py-2.5 px-3 text-center">
                    <div className="inline-block">
                      <ItemImage
                        url={item.resolvedImageUrl}
                        rawLink={item.imageLink}
                        name={item.simplified}
                        itemCategory={item.item}
                        color={item.color}
                        className="w-10 h-10 rounded-lg shadow-2xs"
                        onClick={() => onOpenDetails(item)}
                      />
                    </div>
                  </td>

                  {/* SKU Column */}
                  <td className="py-2.5 px-3">
                    <span
                      onClick={() => onOpenDetails(item)}
                      className="font-mono text-indigo-300 font-bold cursor-pointer hover:text-indigo-200 hover:underline select-all"
                      title={item.sku}
                    >
                      {item.sku}
                    </span>
                  </td>

                  {/* Simplified Name (Inline Editable) */}
                  <td className="py-2.5 px-3">
                    {isEditingThisName ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          onBlur={() => saveEdit(item)}
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit(item)}
                          autoFocus
                          className="w-full bg-slate-900 border-2 border-indigo-500 rounded px-2 py-1 text-xs font-semibold text-white focus:outline-none shadow-xs"
                        />
                        <button
                          onClick={() => saveEdit(item)}
                          className="p-1 rounded bg-indigo-600 text-white hover:bg-indigo-500 shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => startEdit(item.id, 'simplified', item.simplified)}
                        className="flex items-center justify-between cursor-pointer py-1 px-1.5 -mx-1.5 rounded hover:bg-slate-700/60 transition-all group/edit"
                        title="Click to edit simplified name"
                      >
                        <span className="text-white font-bold group-hover/edit:text-indigo-300">
                          {item.simplified}
                        </span>
                        <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover/edit:opacity-100 shrink-0 ml-1" />
                      </div>
                    )}
                  </td>

                  {/* Category */}
                  <td className="py-2.5 px-2">
                    <span className="px-2 py-0.5 rounded-md bg-slate-750 bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-600">
                      {item.item}
                    </span>
                  </td>

                  {/* Color */}
                  <td className="py-2.5 px-2 text-slate-200 font-medium">{item.color}</td>

                  {/* Size */}
                  <td className="py-2.5 px-2 text-slate-300 text-[11px]">{item.size}</td>

                  {/* Stock Quantity Column (Inline Editable + Steppers) */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      {isEditingThisStock ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={editVal}
                            onChange={(e) => setEditVal(e.target.value)}
                            onBlur={() => saveEdit(item)}
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit(item)}
                            autoFocus
                            className="w-16 bg-slate-950 border-2 border-indigo-500 rounded px-1.5 py-0.5 text-xs font-bold text-center text-white focus:outline-none shadow-xs"
                          />
                          <button
                            onClick={() => saveEdit(item)}
                            className="p-1 rounded bg-indigo-600 text-white hover:bg-indigo-500 shadow-xs"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(item.id, 'stock', item.stock.toString())}
                          className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs transition-all border flex items-center gap-1 shadow-2xs hover:ring-2 hover:ring-indigo-500/30 ${
                            isOutOfStock
                              ? 'bg-rose-950/70 text-rose-300 border-rose-700'
                              : isLowStock
                              ? 'bg-amber-950/70 text-amber-300 border-amber-700'
                              : 'bg-slate-700/80 text-white border-slate-600'
                          }`}
                          title="Click to edit stock level"
                        >
                          <span>{item.stock}</span>
                          <Edit2 className="w-2.5 h-2.5 opacity-50" />
                        </button>
                      )}

                      {/* Steppers */}
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => quickAdjustStock(item.id, -1)}
                          disabled={item.stock <= 0}
                          className="p-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:pointer-events-none text-slate-300"
                          title="-1 unit"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => quickAdjustStock(item.id, 1)}
                          className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
                          title="+1 unit"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => quickAdjustStock(item.id, 10)}
                          className="px-1.5 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-[10px] font-bold text-indigo-300 border border-indigo-500/30"
                          title="+10 units batch"
                        >
                          +10
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* MRP */}
                  <td className="py-2.5 px-2 font-mono font-bold text-white">
                    {item.mrp > 0 ? `₹${item.mrp}` : '-'}
                  </td>

                  {/* ASIN / EAN */}
                  <td className="py-2.5 px-3">
                    <div className="text-[11px] font-mono text-slate-400">
                      {item.asin && item.asin !== 'NO DATA' ? (
                        <span className="text-slate-300 font-semibold">{item.asin}</span>
                      ) : item.ean && item.ean !== 'NO DATA' ? (
                        <span className="text-slate-400">{item.ean}</span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </div>
                  </td>

                  {/* Audit History Logs button */}
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => onOpenItemHistory(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-semibold border border-slate-600 transition-colors shadow-2xs"
                      title="Inspect past 3 to 5 updates with date and timestamps"
                    >
                      <Clock className="w-3 h-3 text-sky-400" />
                      <span>{item.history?.length || 1} edits</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
