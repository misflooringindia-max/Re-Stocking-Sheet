import React, { useState } from 'react';
import { InventoryItem } from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import { formatSalesPeriodLabel } from '../utils/csvHelper';
import { ItemImage } from './ItemImage';
import { CopyButton } from './CopyButton';
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
  const { updateStock, updateSimplified, quickAdjustStock, filters, setFilters, getItemSales } =
    useInventory();

  const periodLabel = formatSalesPeriodLabel(filters.salesPeriod);

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

  const handleSort = (field: 'sku' | 'simplified' | 'stock' | 'mrp' | 'sales') => {
    setFilters((p) => {
      let nextSort: any = 'stock-asc';
      if (field === 'stock') {
        nextSort = p.sortBy === 'stock-asc' ? 'stock-desc' : 'stock-asc';
      } else if (field === 'sales') {
        nextSort = p.sortBy === 'sales-desc' ? 'sales-asc' : 'sales-desc';
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
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px] border-collapse">
          <thead>
            <tr className="bg-[var(--table-header-bg)] border-b border-[var(--table-divider)] text-[12px] font-medium text-[var(--text-muted)] select-none">
              <th className="py-3 px-3 w-14 text-center font-medium">Image</th>
              <th
                onClick={() => handleSort('sku')}
                className="py-3 px-3 cursor-pointer hover:text-[var(--text-primary)] transition-colors duration-150 font-medium"
              >
                <div className="flex items-center gap-1">
                  <span>Uniware SKU</span>
                  <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
                </div>
              </th>
              <th
                onClick={() => handleSort('simplified')}
                className="py-3 px-3 cursor-pointer hover:text-[var(--text-primary)] transition-colors duration-150 min-w-[220px] font-medium"
              >
                <div className="flex items-center gap-1">
                  <span>Simplified article name</span>
                  <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
                </div>
              </th>
              <th className="py-3 px-2.5 font-medium">Category</th>
              <th className="py-3 px-2.5 font-medium">Color</th>
              <th className="py-3 px-2.5 font-medium">Size</th>
              <th
                onClick={() => handleSort('stock')}
                className="py-3 px-3 cursor-pointer hover:text-[var(--text-primary)] transition-colors duration-150 min-w-[180px] font-medium"
              >
                <div className="flex items-center gap-1">
                  <span>Stock / Qty</span>
                  <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
                </div>
              </th>
              <th
                onClick={() => handleSort('sales')}
                className="py-3 px-2.5 cursor-pointer hover:text-[var(--text-primary)] transition-colors duration-150 font-medium whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Sales ({periodLabel})</span>
                  <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
                </div>
              </th>
              <th
                onClick={() => handleSort('mrp')}
                className="py-3 px-2.5 cursor-pointer hover:text-[var(--text-primary)] transition-colors duration-150 font-medium"
              >
                <div className="flex items-center gap-1">
                  <span>MRP</span>
                  <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
                </div>
              </th>
              <th className="py-3 px-3 font-medium">ASIN / EAN</th>
              <th className="py-3 px-3 text-right font-medium">History</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--table-divider)] text-[var(--text-primary)] font-normal">
            {items.map((item) => {
              const periodSales = getItemSales(item.simplified, filters.salesPeriod);
              const isOutOfStock = item.stock === 0;
              const isLowStock = !isOutOfStock && item.stock <= filters.lowStockThreshold;

              const isEditingThisName = editingId === item.id && editingField === 'simplified';
              const isEditingThisStock = editingId === item.id && editingField === 'stock';

              const stockPillClass = isOutOfStock
                ? 'bg-[var(--status-out-bg)] text-[var(--status-out-text)]'
                : isLowStock
                ? 'bg-[var(--status-low-bg)] text-[var(--status-low-text)]'
                : 'bg-[var(--status-in-bg)] text-[var(--status-in-text)]';

              return (
                <tr
                  key={item.id}
                  className="hover:bg-[var(--table-hover)] transition-colors duration-150 group"
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
                        className="w-10 h-10 rounded-lg"
                        onClick={() => onOpenDetails(item)}
                      />
                    </div>
                  </td>

                  {/* SKU Column */}
                  <td className="py-2.5 px-3">
                    <div className="group/sku flex items-center gap-1.5">
                      <span
                        onClick={() => onOpenDetails(item)}
                        className="font-mono text-[12px] text-[var(--text-muted)] cursor-pointer hover:text-[var(--accent)] hover:underline select-all transition-colors duration-150"
                        title={item.sku}
                      >
                        {item.sku}
                      </span>
                      <CopyButton
                        value={item.sku}
                        label="Copy SKU"
                        className="opacity-0 group-hover/sku:opacity-100 focus-visible:opacity-100"
                      />
                    </div>
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
                          className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-2 py-1 text-[13px] font-medium text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                        />
                        <button
                          onClick={() => saveEdit(item)}
                          className="p-1.5 rounded-lg bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-white transition-colors duration-150"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => startEdit(item.id, 'simplified', item.simplified)}
                        className="flex items-center justify-between gap-1.5 cursor-pointer py-1 px-1.5 -mx-1.5 rounded-lg hover:bg-[var(--surface-subtle)] transition-colors duration-150 group/edit"
                        title="Click to edit simplified name"
                      >
                        <span className="text-[var(--text-primary)] font-medium group-hover/edit:text-[var(--accent)]">
                          {item.simplified}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <CopyButton
                            value={item.simplified}
                            label="Copy name"
                            className="opacity-0 group-hover/edit:opacity-100 focus-visible:opacity-100"
                          />
                          <Edit2 className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover/edit:opacity-100" />
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Category */}
                  <td className="py-2.5 px-2.5">
                    <span className="px-2 py-0.5 rounded-full bg-[var(--surface-subtle)] text-[11px] font-medium text-[var(--text-muted)]">
                      {item.item}
                    </span>
                  </td>

                  {/* Color */}
                  <td className="py-2.5 px-2.5 text-[var(--text-muted)]">{item.color}</td>

                  {/* Size */}
                  <td className="py-2.5 px-2.5 text-[var(--text-muted)] text-[12px]">{item.size}</td>

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
                            className="w-16 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-1.5 py-1 text-[12px] font-medium text-center text-[var(--text-primary)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                          />
                          <button
                            onClick={() => saveEdit(item)}
                            className="p-1.5 rounded-lg bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-white transition-colors duration-150"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="group/qty flex items-center gap-1">
                          <button
                            onClick={() => startEdit(item.id, 'stock', item.stock.toString())}
                            className={`px-2.5 py-1 rounded-lg font-mono font-medium text-[12px] transition-colors duration-150 flex items-center gap-1.5 ${stockPillClass}`}
                            title="Click to edit stock level"
                          >
                            <span>{item.stock}</span>
                            <Edit2 className="w-2.5 h-2.5 opacity-70" />
                          </button>
                          <CopyButton
                            value={item.stock}
                            label="Copy qty"
                            className="opacity-0 group-hover/qty:opacity-100 focus-visible:opacity-100"
                          />
                        </div>
                      )}

                      {/* Outlined Steppers */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => quickAdjustStock(item.id, -1)}
                          disabled={item.stock <= 0}
                          className="p-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] disabled:opacity-35 disabled:pointer-events-none text-[var(--text-primary)] transition-colors duration-150"
                          title="-1 unit"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => quickAdjustStock(item.id, 1)}
                          className="p-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] transition-colors duration-150"
                          title="+1 unit"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => quickAdjustStock(item.id, 10)}
                          className="px-2 py-1 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[11px] font-medium text-[var(--text-primary)] transition-colors duration-150"
                          title="+10 units batch"
                        >
                          +10
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* Sales for selected period */}
                  <td className="py-2.5 px-2.5 font-mono font-medium text-[var(--text-primary)] whitespace-nowrap">
                    {periodSales.toLocaleString()}
                  </td>

                  {/* MRP */}
                  <td className="py-2.5 px-2.5 font-mono font-medium text-[var(--text-primary)]">
                    {item.mrp > 0 ? `₹${item.mrp}` : '-'}
                  </td>

                  {/* ASIN / EAN */}
                  <td className="py-2.5 px-3">
                    <div className="text-[12px] font-mono text-[var(--text-muted)]">
                      {item.asin && item.asin !== 'NO DATA' ? (
                        <span>{item.asin}</span>
                      ) : item.ean && item.ean !== 'NO DATA' ? (
                        <span>{item.ean}</span>
                      ) : (
                        <span>-</span>
                      )}
                    </div>
                  </td>

                  {/* Audit History Logs button */}
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => onOpenItemHistory(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--card-bg)] hover:bg-[var(--table-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[12px] font-normal border border-[var(--border)] transition-colors duration-150"
                      title="Inspect past 3 to 5 updates with date and timestamps"
                    >
                      <Clock className="w-3 h-3 text-[var(--text-muted)]" />
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
