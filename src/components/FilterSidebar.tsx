import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useInventory } from '../context/InventoryContext';
import { formatSalesPeriodLabel } from '../utils/csvHelper';
import { SalesPeriod, StockStatus } from '../types/inventory';
import {
  ChevronUp,
  ChevronDown,
  RotateCcw,
  X,
  ChevronsUpDown,
  ChevronsDownUp,
  SlidersHorizontal,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

export type FilterSectionKey =
  | 'category'
  | 'color'
  | 'size'
  | 'sortBy'
  | 'status'
  | 'salesPeriod'
  | 'dateRange'
  | 'salesActivity'
  | 'threshold';

type AccordionState = Record<FilterSectionKey, boolean>;

const ACCORDION_STORAGE_KEY = 'stocksync_sidebar_accordion_v3';

const DEFAULT_ACCORDION_STATE: AccordionState = {
  category: true,
  color: true,
  size: true,
  sortBy: false,
  status: true,
  salesPeriod: true,
  dateRange: true,
  salesActivity: false,
  threshold: false,
};

const SALES_PERIOD_PRESETS: { value: SalesPeriod; label: string }[] = [
  { value: '1m', label: '1 Month' },
  { value: '3m', label: '3 Months' },
  { value: '6m', label: '6 Months' },
  { value: '12m', label: '12 Months' },
  { value: 'all', label: 'All Time' },
];

const STOCK_STATUS_OPTIONS: { value: StockStatus; label: string; shortLabel: string }[] = [
  { value: 'all', label: 'All', shortLabel: 'All' },
  { value: 'out_of_stock', label: '0 Out of Stock', shortLabel: 'Stock: Out' },
  { value: 'low_stock', label: 'Low Stock', shortLabel: 'Stock: Low' },
  { value: 'in_stock', label: 'In Stock', shortLabel: 'Stock: In' },
];

const SORT_SHORT_LABELS: Record<string, string> = {
  'stock-asc': 'Stock ↑',
  'stock-desc': 'Stock ↓',
  'sales-desc': 'Sales ↓',
  'sales-asc': 'Sales ↑',
  simplified: 'A – Z',
  sku: 'SKU',
  'mrp-desc': 'MRP ↓',
  updated: 'Updated',
};

interface AccordionSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  activeBadge?: string | null;
  isHighlighted?: boolean;
  children: React.ReactNode;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({
  title,
  isOpen,
  onToggle,
  activeBadge,
  isHighlighted = false,
  children,
}) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(isOpen);

  useEffect(() => {
    const prevOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!prevOpen && isOpen && sectionRef.current) {
      const timer = window.setTimeout(() => {
        sectionRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 220);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <div ref={sectionRef} className="border-b border-[var(--table-divider)] last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-[var(--table-hover)] transition-colors duration-150"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">
            {title}
          </span>
          {!isOpen && activeBadge && (
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium truncate max-w-[120px] border ${
                isHighlighted
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]'
                  : 'bg-[var(--surface-subtle)] text-[var(--text-muted)] border-[var(--border)]'
              }`}
              title={activeBadge}
            >
              {activeBadge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-[var(--text-muted)] shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : 'rotate-0'
          }`}
        />
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-250 ease-in-out ${
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-3.5 pb-3 pt-1">{children}</div>
        </div>
      </div>
    </div>
  );
};

interface SidebarScrollAreaProps {
  children: React.ReactNode;
}

const SidebarScrollArea: React.FC<SidebarScrollAreaProps> = ({ children }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ startY: number; startScrollTop: number } | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [scrollBounds, setScrollBounds] = useState({
    canScroll: false,
    atTop: true,
    atBottom: true,
  });

  const syncThumb = useCallback(() => {
    const el = scrollRef.current;
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!el || !track || !thumb) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const maxScroll = Math.max(0, scrollHeight - clientHeight);
    const canScroll = maxScroll > 2;
    const trackHeight = track.clientHeight;

    if (!canScroll || trackHeight <= 0) {
      thumb.style.height = `${Math.max(24, trackHeight)}px`;
      thumb.style.transform = 'translateY(0px)';
    } else {
      const ratio = clientHeight / scrollHeight;
      const thumbHeight = Math.max(28, Math.round(trackHeight * ratio));
      const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
      const thumbTop = Math.round((scrollTop / maxScroll) * maxThumbTop);
      thumb.style.height = `${thumbHeight}px`;
      thumb.style.transform = `translateY(${thumbTop}px)`;
    }

    setScrollBounds((prev) => {
      const atTop = scrollTop <= 1;
      const atBottom = scrollTop >= maxScroll - 1;
      if (
        prev.canScroll === canScroll &&
        prev.atTop === atTop &&
        prev.atBottom === atBottom
      ) {
        return prev;
      }
      return { canScroll, atTop, atBottom };
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    const track = trackRef.current;
    if (!el) return;

    syncThumb();

    const resizeObserver = new ResizeObserver(() => {
      syncThumb();
    });
    resizeObserver.observe(el);
    if (content) resizeObserver.observe(content);
    if (track) resizeObserver.observe(track);

    const mutationObserver = new MutationObserver(() => {
      requestAnimationFrame(syncThumb);
    });
    mutationObserver.observe(el, { childList: true, subtree: true, attributes: true });

    const onTransitionEnd = () => syncThumb();
    el.addEventListener('transitionend', onTransitionEnd);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      el.removeEventListener('transitionend', onTransitionEnd);
    };
  }, [syncThumb]);

  const scrollByStep = (delta: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ top: delta, behavior: 'smooth' });
  };

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!el || !track || !thumb) return;

    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) return;

    e.preventDefault();
    track.setPointerCapture(e.pointerId);
    setIsDragging(true);

    const thumbRect = thumb.getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();
    const clickedOnThumb = e.clientY >= thumbRect.top && e.clientY <= thumbRect.bottom;

    if (!clickedOnThumb) {
      const thumbHeight = thumb.offsetHeight;
      const maxThumbTop = Math.max(1, trackRect.height - thumbHeight);
      const targetThumbTop = Math.max(
        0,
        Math.min(maxThumbTop, e.clientY - trackRect.top - thumbHeight / 2)
      );
      el.scrollTop = (targetThumbTop / maxThumbTop) * maxScroll;
    }

    dragStateRef.current = {
      startY: e.clientY,
      startScrollTop: el.scrollTop,
    };
  };

  const handleTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    const el = scrollRef.current;
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!drag || !el || !track || !thumb) return;

    const maxScroll = el.scrollHeight - el.clientHeight;
    const maxThumbTop = Math.max(1, track.clientHeight - thumb.offsetHeight);
    if (maxScroll <= 0) return;

    const deltaY = e.clientY - drag.startY;
    const deltaScroll = (deltaY / maxThumbTop) * maxScroll;
    el.scrollTop = Math.max(0, Math.min(maxScroll, drag.startScrollTop + deltaScroll));
  };

  const handleTrackPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return;
    dragStateRef.current = null;
    setIsDragging(false);
    try {
      trackRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // ignore if already released
    }
  };

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden">
      {/* Scrollable Filter Sections */}
      <div
        ref={scrollRef}
        onScroll={syncThumb}
        className="flex-1 min-w-0 min-h-0 h-full overflow-y-auto no-scrollbar"
      >
        <div ref={contentRef} className="divide-y-0">
          {children}
        </div>
      </div>

      {/* Dedicated Left-Panel Vertical Slider Rail (Up / Draggable Thumb / Down) */}
      <div
        className="w-[18px] shrink-0 border-l border-[var(--table-divider)] bg-[var(--table-header-bg)] flex flex-col items-center py-1 select-none"
        aria-label="Filter panel vertical scroll slider"
      >
        <button
          type="button"
          onClick={() => scrollByStep(-120)}
          disabled={!scrollBounds.canScroll || scrollBounds.atTop}
          title="Move panel up"
          aria-label="Move filter panel up"
          className="w-4 h-4 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--card-bg)] disabled:opacity-30 disabled:pointer-events-none transition-colors duration-150"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>

        <div
          ref={trackRef}
          onPointerDown={handleTrackPointerDown}
          onPointerMove={handleTrackPointerMove}
          onPointerUp={handleTrackPointerUp}
          onPointerCancel={handleTrackPointerUp}
          title="Drag slider up or down to scroll filters"
          className="flex-1 w-full relative my-1 cursor-pointer touch-none flex justify-center"
        >
          {/* Subtle Track Line */}
          <div className="w-[3px] h-full rounded-full bg-[var(--border)]" />

          {/* Draggable Slider Thumb */}
          <div
            ref={thumbRef}
            className={`absolute top-0 w-[8px] rounded-full transition-colors duration-150 ${
              !scrollBounds.canScroll
                ? 'bg-[#D0D4DC]'
                : isDragging
                ? 'bg-[var(--accent)]'
                : 'bg-[#9AA1AD] hover:bg-[var(--accent)]'
            }`}
          />
        </div>

        <button
          type="button"
          onClick={() => scrollByStep(120)}
          disabled={!scrollBounds.canScroll || scrollBounds.atBottom}
          title="Move panel down"
          aria-label="Move filter panel down"
          className="w-4 h-4 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--card-bg)] disabled:opacity-30 disabled:pointer-events-none transition-colors duration-150"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

interface FilterSidebarProps {
  isDesktopOpen: boolean;
  onToggleDesktop: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onResetAll: () => void;
  activeFilterCount: number;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  isDesktopOpen,
  onToggleDesktop,
  isMobileOpen,
  onCloseMobile,
  onResetAll,
  activeFilterCount,
}) => {
  const {
    filters,
    setFilters,
    categories,
    colors,
    sizes,
    salesData,
    isSyncingSales,
    isLoadingRangeSales,
    rangeSalesError,
    stats,
  } = useInventory();

  const [openSections, setOpenSections] = useState<AccordionState>(() => {
    try {
      const saved = localStorage.getItem(ACCORDION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_ACCORDION_STATE, ...parsed };
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_ACCORDION_STATE;
  });

  useEffect(() => {
    try {
      localStorage.setItem(ACCORDION_STORAGE_KEY, JSON.stringify(openSections));
    } catch {
      // ignore storage errors
    }
  }, [openSections]);

  const toggleSection = (key: FilterSectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    setOpenSections({
      category: true,
      color: true,
      size: true,
      sortBy: true,
      status: true,
      salesPeriod: true,
      dateRange: true,
      salesActivity: true,
      threshold: true,
    });
  };

  const collapseAll = () => {
    setOpenSections({
      category: false,
      color: false,
      size: false,
      sortBy: false,
      status: false,
      salesPeriod: false,
      dateRange: false,
      salesActivity: false,
      threshold: false,
    });
  };

  const isCustomRangeActive = filters.salesPeriod.startsWith('range:');
  const activeRangeParts = isCustomRangeActive ? filters.salesPeriod.slice(6).split('..') : ['', ''];
  const [draftFromDate, setDraftFromDate] = useState<string>(activeRangeParts[0] || '');
  const [draftToDate, setDraftToDate] = useState<string>(activeRangeParts[1] || '');

  useEffect(() => {
    if (filters.salesPeriod.startsWith('range:')) {
      const [f, t] = filters.salesPeriod.slice(6).split('..');
      setDraftFromDate(f || '');
      setDraftToDate(t || '');
    } else {
      setDraftFromDate('');
      setDraftToDate('');
    }
  }, [filters.salesPeriod]);

  const applyDateRange = (nextFrom: string, nextTo: string) => {
    setDraftFromDate(nextFrom);
    setDraftToDate(nextTo);
    if (nextFrom && nextTo && nextFrom <= nextTo) {
      setFilters((p) => ({
        ...p,
        salesPeriod: `range:${nextFrom}..${nextTo}`,
      }));
    }
  };

  const applyRelativeMonthsRange = (months: number) => {
    if (!salesData?.maxDate) return;
    const endDate = new Date(`${salesData.maxDate}T00:00:00Z`);
    if (Number.isNaN(endDate.getTime())) return;
    const startDate = new Date(endDate);
    startDate.setUTCMonth(startDate.getUTCMonth() - months);
    startDate.setUTCDate(startDate.getUTCDate() + 1);
    const minMs = salesData.minDate ? Date.parse(`${salesData.minDate}T00:00:00Z`) : 0;
    const finalStart =
      minMs && startDate.getTime() < minMs ? salesData.minDate : startDate.toISOString().slice(0, 10);
    applyDateRange(finalStart, salesData.maxDate);
  };

  const clearDateRange = () => {
    setDraftFromDate('');
    setDraftToDate('');
    if (filters.salesPeriod.startsWith('range:')) {
      setFilters((p) => ({ ...p, salesPeriod: '3m' }));
    }
  };

  const isInvalidRange = Boolean(draftFromDate && draftToDate && draftFromDate > draftToDate);

  const activePeriodLabel = formatSalesPeriodLabel(filters.salesPeriod);
  const selectedMonthValue = filters.salesPeriod.startsWith('month:')
    ? filters.salesPeriod
    : '';

  const salesPeriodFullLabel = (() => {
    const preset = SALES_PERIOD_PRESETS.find((p) => p.value === filters.salesPeriod);
    if (preset) return preset.label;
    return activePeriodLabel;
  })();

  const statusShortBadge =
    filters.status !== 'all'
      ? STOCK_STATUS_OPTIONS.find((o) => o.value === filters.status)?.shortLabel || filters.status
      : null;

  const salesActivityBadge =
    filters.salesActivity === 'with_sales'
      ? 'Has sales'
      : filters.salesActivity === 'no_sales'
      ? 'No sales'
      : null;

  const renderSidebarBody = (isDrawer: boolean) => (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-[var(--card-bg)]">
      {/* Sidebar Top Controls: Expand All / Collapse All / Reset / Collapse («) */}
      <div className="px-3 py-2.5 border-b border-[var(--table-divider)] flex items-center justify-between gap-1.5 shrink-0 bg-[var(--card-bg)]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={expandAll}
            className="px-2 py-1 rounded-lg bg-[var(--surface-subtle)] hover:bg-[var(--table-hover)] border border-[var(--border)] text-[11px] font-medium text-[var(--text-primary)] inline-flex items-center gap-1 transition-colors duration-150"
            title="Expand all filter sections"
          >
            <ChevronsUpDown className="w-3 h-3 text-[var(--text-muted)]" />
            <span>Expand All</span>
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-2 py-1 rounded-lg bg-[var(--surface-subtle)] hover:bg-[var(--table-hover)] border border-[var(--border)] text-[11px] font-medium text-[var(--text-primary)] inline-flex items-center gap-1 transition-colors duration-150"
            title="Collapse all filter sections"
          >
            <ChevronsDownUp className="w-3 h-3 text-[var(--text-muted)]" />
            <span>Collapse All</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={onResetAll}
              className="px-1.5 py-1 rounded-lg text-[11px] font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] inline-flex items-center gap-1 transition-colors duration-150"
              title="Reset all filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
          {!isDrawer && (
            <button
              type="button"
              onClick={onToggleDesktop}
              className="p-1.5 rounded-lg bg-[var(--surface-subtle)] hover:bg-[var(--accent-soft)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors duration-150"
              title="Hide filters (Ctrl+B)"
              aria-label="Hide filters sidebar"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Accordion Filter List + Vertical Slider */}
      <SidebarScrollArea>
        {/* 1. Category Filter */}
        <AccordionSection
          title="Category"
          isOpen={openSections.category}
          onToggle={() => toggleSection('category')}
          activeBadge={filters.category !== 'all' ? filters.category : null}
          isHighlighted={filters.category !== 'all'}
        >
          <select
            value={filters.category}
            onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}
            className={`w-full rounded-lg px-2.5 py-2 text-[13px] border focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors duration-150 ${
              filters.category !== 'all'
                ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)] font-medium'
                : 'bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-primary)] font-normal'
            }`}
          >
            <option value="all">All Articles ({categories.length})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </AccordionSection>

        {/* 2. Colour Filter */}
        <AccordionSection
          title="Colour"
          isOpen={openSections.color}
          onToggle={() => toggleSection('color')}
          activeBadge={filters.color !== 'all' ? filters.color : null}
          isHighlighted={filters.color !== 'all'}
        >
          <select
            value={filters.color}
            onChange={(e) => setFilters((p) => ({ ...p, color: e.target.value }))}
            className={`w-full rounded-lg px-2.5 py-2 text-[13px] border focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors duration-150 ${
              filters.color !== 'all'
                ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)] font-medium'
                : 'bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-primary)] font-normal'
            }`}
          >
            <option value="all">All Colours ({colors.length})</option>
            {colors.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </AccordionSection>

        {/* 3. Size Filter */}
        <AccordionSection
          title="Size"
          isOpen={openSections.size}
          onToggle={() => toggleSection('size')}
          activeBadge={filters.size !== 'all' ? filters.size : null}
          isHighlighted={filters.size !== 'all'}
        >
          <select
            value={filters.size}
            onChange={(e) => setFilters((p) => ({ ...p, size: e.target.value }))}
            className={`w-full rounded-lg px-2.5 py-2 text-[13px] border focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors duration-150 ${
              filters.size !== 'all'
                ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)] font-medium'
                : 'bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-primary)] font-normal'
            }`}
          >
            <option value="all">All Sizes ({sizes.length})</option>
            {sizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </AccordionSection>

        {/* 2. Stock Status */}
        <AccordionSection
          title="Stock Status"
          isOpen={openSections.status}
          onToggle={() => toggleSection('status')}
          activeBadge={statusShortBadge}
          isHighlighted={filters.status !== 'all'}
        >
          <div className="grid grid-cols-2 gap-1.5">
            {STOCK_STATUS_OPTIONS.map((st) => {
              const active = filters.status === st.value;
              return (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => setFilters((p) => ({ ...p, status: st.value }))}
                  className={`px-2.5 py-1.5 rounded-lg text-[12px] border text-left transition-colors duration-150 truncate ${
                    active
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)] font-medium'
                      : 'bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--table-hover)] font-normal'
                  }`}
                >
                  {st.label}
                </button>
              );
            })}
          </div>
        </AccordionSection>

        {/* 3. Sales Window */}
        <AccordionSection
          title="Sales Window"
          isOpen={openSections.salesPeriod}
          onToggle={() => toggleSection('salesPeriod')}
          activeBadge={salesPeriodFullLabel}
          isHighlighted={true}
        >
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {SALES_PERIOD_PRESETS.map((preset) => {
                const active = filters.salesPeriod === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setFilters((p) => ({ ...p, salesPeriod: preset.value }))}
                    className={`px-2.5 py-1.5 rounded-lg text-[12px] border transition-colors duration-150 ${
                      active
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)] font-medium'
                        : 'bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--table-hover)] font-normal'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {salesData && salesData.availableMonths.length > 0 && (
              <select
                value={selectedMonthValue}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    setFilters((p) => ({ ...p, salesPeriod: val as SalesPeriod }));
                  } else {
                    setFilters((p) => ({ ...p, salesPeriod: '3m' }));
                  }
                }}
                className={`w-full rounded-lg px-2.5 py-1.5 text-[12px] border focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors duration-150 ${
                  selectedMonthValue
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)] font-medium'
                    : 'bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-primary)] font-normal'
                }`}
              >
                <option value="">Pick specific month...</option>
                {salesData.availableMonths.map((ym) => (
                  <option key={ym} value={`month:${ym}`}>
                    {formatSalesPeriodLabel(`month:${ym}`)}
                  </option>
                ))}
              </select>
            )}

            <div className="text-[11px] text-[var(--text-muted)] pt-0.5 space-y-1">
              {salesData?.windowLabels &&
                (filters.salesPeriod === '1m' ||
                  filters.salesPeriod === '3m' ||
                  filters.salesPeriod === '6m' ||
                  filters.salesPeriod === '12m') && (
                  <div className="flex items-center justify-between">
                    <span>Calendar span:</span>
                    <span className="font-medium text-[var(--text-primary)]">
                      {
                        salesData.windowLabels[
                          filters.salesPeriod === '1m'
                            ? 'm1'
                            : filters.salesPeriod === '3m'
                            ? 'm3'
                            : filters.salesPeriod === '6m'
                            ? 'm6'
                            : 'm12'
                        ]
                      }
                    </span>
                  </div>
                )}
              <div className="flex items-center justify-between">
                <span>{activePeriodLabel} filtered total:</span>
                <span className="font-mono font-medium text-[var(--text-primary)]">
                  {isSyncingSales || isLoadingRangeSales
                    ? 'Loading...'
                    : `${stats.filteredSalesTotal.toLocaleString()} units`}
                </span>
              </div>
            </div>
          </div>
        </AccordionSection>

        {/* 4. Custom Date Range */}
        <AccordionSection
          title="Date Range"
          isOpen={openSections.dateRange}
          onToggle={() => toggleSection('dateRange')}
          activeBadge={isCustomRangeActive ? activePeriodLabel : null}
          isHighlighted={isCustomRangeActive}
        >
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">From</label>
                <input
                  type="date"
                  value={draftFromDate}
                  min={salesData?.minDate || undefined}
                  max={draftToDate || salesData?.maxDate || undefined}
                  onChange={(e) => applyDateRange(e.target.value, draftToDate)}
                  className={`w-full rounded-lg px-2 py-1.5 text-[11px] border focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors duration-150 ${
                    isCustomRangeActive
                      ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)] font-medium'
                      : 'bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-primary)] font-normal'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">To</label>
                <input
                  type="date"
                  value={draftToDate}
                  min={draftFromDate || salesData?.minDate || undefined}
                  max={salesData?.maxDate || undefined}
                  onChange={(e) => applyDateRange(draftFromDate, e.target.value)}
                  className={`w-full rounded-lg px-2 py-1.5 text-[11px] border focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors duration-150 ${
                    isCustomRangeActive
                      ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)] font-medium'
                      : 'bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-primary)] font-normal'
                  }`}
                />
              </div>
            </div>

            {/* Quick Custom Date Range Shortcuts */}
            <div className="flex items-center justify-between gap-1 pt-0.5">
              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { label: '3M', months: 3 },
                  { label: '6M', months: 6 },
                  { label: '12M', months: 12 },
                ].map((quick) => (
                  <button
                    key={quick.label}
                    type="button"
                    disabled={!salesData?.maxDate}
                    onClick={() => applyRelativeMonthsRange(quick.months)}
                    className="px-2 py-0.5 rounded-md text-[11px] border border-[var(--border)] bg-[var(--surface-subtle)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] hover:border-[var(--accent)] disabled:opacity-40 text-[var(--text-primary)] font-medium transition-colors duration-150"
                    title={`Fill last ${quick.months} months by exact date`}
                  >
                    Last {quick.label}
                  </button>
                ))}
              </div>

              {(draftFromDate || draftToDate || isCustomRangeActive) && (
                <button
                  type="button"
                  onClick={clearDateRange}
                  className="text-[11px] font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors duration-150 shrink-0"
                >
                  Clear
                </button>
              )}
            </div>

            {isInvalidRange && (
              <div className="text-[11px] font-medium text-[var(--accent)]">
                From date must be on or before To date.
              </div>
            )}

            {rangeSalesError && (
              <div className="text-[11px] font-medium text-[var(--accent)]">{rangeSalesError}</div>
            )}

            {isCustomRangeActive && !rangeSalesError && (
              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-0.5">
                <span>Range total:</span>
                <span className="font-mono font-medium text-[var(--accent)]">
                  {isLoadingRangeSales
                    ? 'Calculating...'
                    : `${stats.filteredSalesTotal.toLocaleString()} units`}
                </span>
              </div>
            )}
          </div>
        </AccordionSection>

        {/* 5. Stock Sort */}
        <AccordionSection
          title="Stock Sort"
          isOpen={openSections.sortBy}
          onToggle={() => toggleSection('sortBy')}
          activeBadge={
            filters.sortBy !== 'stock-asc'
              ? SORT_SHORT_LABELS[filters.sortBy] || filters.sortBy
              : null
          }
          isHighlighted={filters.sortBy !== 'stock-asc'}
        >
          <select
            value={filters.sortBy}
            onChange={(e) => setFilters((p) => ({ ...p, sortBy: e.target.value as any }))}
            className={`w-full rounded-lg px-2.5 py-2 text-[13px] border focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors duration-150 ${
              filters.sortBy !== 'stock-asc'
                ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)] font-medium'
                : 'bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-primary)] font-normal'
            }`}
          >
            <option value="stock-asc">Stock: Low to High (Alerts first)</option>
            <option value="stock-desc">Stock: High to Low</option>
            <option value="sales-desc">Sales ({activePeriodLabel}): High to Low</option>
            <option value="sales-asc">Sales ({activePeriodLabel}): Low to High</option>
            <option value="simplified">Name (A - Z)</option>
            <option value="sku">SKU Code</option>
            <option value="mrp-desc">Price / MRP: High to Low</option>
            <option value="updated">Recently Updated</option>
          </select>
        </AccordionSection>

        {/* 6. Sales Filter */}
        <AccordionSection
          title="Sales Filter"
          isOpen={openSections.salesActivity}
          onToggle={() => toggleSection('salesActivity')}
          activeBadge={salesActivityBadge}
          isHighlighted={filters.salesActivity !== 'all'}
        >
          <select
            value={filters.salesActivity}
            onChange={(e) =>
              setFilters((p) => ({ ...p, salesActivity: e.target.value as any }))
            }
            className={`w-full rounded-lg px-2.5 py-2 text-[13px] border focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors duration-150 ${
              filters.salesActivity !== 'all'
                ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)] font-medium'
                : 'bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-primary)] font-normal'
            }`}
          >
            <option value="all">All articles</option>
            <option value="with_sales">Has sales ({activePeriodLabel} &gt; 0)</option>
            <option value="no_sales">No sales ({activePeriodLabel} = 0)</option>
          </select>
        </AccordionSection>

        {/* 7. Low-stock Alert Threshold */}
        <AccordionSection
          title="Low-stock Alert Threshold"
          isOpen={openSections.threshold}
          onToggle={() => toggleSection('threshold')}
          activeBadge={`≤ ${filters.lowStockThreshold}`}
          isHighlighted={filters.lowStockThreshold !== 15}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[12px] text-[var(--text-muted)]">
              <span>Alert when stock is:</span>
              <span className="font-medium text-[var(--accent)] px-2 py-0.5 bg-[var(--accent-soft)] border border-[var(--accent)] rounded-lg">
                ≤ {filters.lowStockThreshold} units
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[5, 10, 15, 20, 30].map((num) => {
                const active = filters.lowStockThreshold === num;
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setFilters((p) => ({ ...p, lowStockThreshold: num }))}
                    className={`py-1.5 rounded-lg text-[12px] border text-center transition-colors duration-150 ${
                      active
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)] font-medium'
                        : 'bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--table-hover)] font-normal'
                    }`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
          </div>
        </AccordionSection>
      </SidebarScrollArea>

      {/* Bottom Footer: Reset on Desktop, Apply + Reset on Mobile/Tablet Drawer */}
      {isDrawer ? (
        <div className="p-3.5 border-t border-[var(--table-divider)] bg-[var(--card-bg)] flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onResetAll}
            className="flex-1 px-3 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[13px] font-medium transition-colors duration-150"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            className="flex-1 px-3 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[13px] font-medium transition-colors duration-150"
          >
            Apply
          </button>
        </div>
      ) : (
        <div className="p-3 border-t border-[var(--table-divider)] bg-[var(--card-bg)] shrink-0">
          <button
            type="button"
            onClick={onResetAll}
            disabled={activeFilterCount === 0}
            className="w-full px-3 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] disabled:opacity-45 text-[var(--text-primary)] text-[12px] font-medium flex items-center justify-center gap-1.5 transition-colors duration-150"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>Reset filters</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Collapsible Left Sidebar (>= lg) inside CSS Grid 280px <-> 0px column */}
      <aside
        className={`hidden lg:block min-w-0 transition-[opacity,transform] duration-250 ease-in-out ${
          isDesktopOpen
            ? 'opacity-100 translate-x-0 overflow-x-clip'
            : 'opacity-0 -translate-x-4 pointer-events-none overflow-hidden max-h-[calc(100vh-136px)]'
        }`}
        aria-hidden={!isDesktopOpen}
      >
        <div className="w-[280px] sticky top-[76px] max-h-[calc(100vh-136px)] bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden flex flex-col">
          {renderSidebarBody(false)}
        </div>
      </aside>

      {/* Excel-style Sticky Left Edge Tab (« / ») when Desktop Sidebar is Hidden */}
      {!isDesktopOpen && (
        <button
          type="button"
          onClick={onToggleDesktop}
          title="Show filters"
          aria-label="Show filters"
          className="hidden lg:flex fixed left-0 top-1/2 -translate-y-1/2 z-20 w-[22px] h-24 rounded-r-lg bg-[var(--card-bg)] border border-l-0 border-[var(--border)] hover:bg-[var(--accent-soft)] hover:border-[var(--accent)] text-[var(--text-muted)] hover:text-[var(--accent)] flex-col items-center justify-center gap-1.5 transition-colors duration-150"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
          {activeFilterCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
          )}
        </button>
      )}

      {/* Mobile & Tablet Slide-in Drawer (< lg) */}
      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-250 ${
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-[var(--overlay-bg)]"
          aria-hidden="true"
        />

        {/* Left Drawer Panel */}
        <aside
          className={`fixed inset-y-0 left-0 w-[290px] max-w-[85vw] bg-[var(--card-bg)] border-r border-[var(--border)] flex flex-col transition-transform duration-250 ease-out ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="px-4 py-3 border-b border-[var(--table-divider)] flex items-center justify-between bg-[var(--header-bg)] text-white shrink-0">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-white/80" />
              <span className="text-[14px] font-medium">Filters</span>
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-white/15 text-white text-[11px] font-medium leading-none">
                  {activeFilterCount}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors duration-150"
              aria-label="Close filters drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 min-h-0 flex flex-col">{renderSidebarBody(true)}</div>
        </aside>
      </div>
    </>
  );
};
