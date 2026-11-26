import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import {
  FileSpreadsheet,
  Upload,
  Link2,
  Check,
  AlertCircle,
  Database,
  RefreshCw,
} from 'lucide-react';

interface ImportSheetBannerProps {
  onOpenSync: () => void;
}

export const ImportSheetBanner: React.FC<ImportSheetBannerProps> = ({ onOpenSync }) => {
  const {
    stats,
    importCsvData,
    syncFromLiveSheet,
    syncSalesSheet,
    salesData,
    connectedSheetUrl,
    lastSyncTime,
    isSyncing,
    isSyncingSales,
    isOnline,
    syncError,
    salesSyncError,
  } = useInventory();
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const hasLoadedFull = stats.totalSkus > 1000;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus(`Reading ${file.name}...`);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = importCsvData(content);
        if (res.success) {
          setIsError(false);
          setStatus(`Loaded all ${res.count.toLocaleString()} items from CSV.`);
        } else {
          setIsError(true);
          setStatus(res.error || 'Failed to parse spreadsheet file.');
        }
      }
    };
    reader.readAsText(file);
  };

  const handleDirectSync = async () => {
    setStatus('Syncing latest stock and sales from Google Sheets...');
    setIsError(false);
    const [res] = await Promise.all([
      syncFromLiveSheet(connectedSheetUrl),
      syncSalesSheet(undefined, { forceRefresh: true }),
    ]);
    if (res.success) {
      setIsError(false);
      setStatus(`Synced ${res.count.toLocaleString()} products from your Google Sheet.`);
    } else {
      setIsError(true);
      setStatus(res.error || 'Failed to sync Google Sheet.');
    }
  };

  const formattedLastSync = (() => {
    try {
      return new Date(lastSyncTime).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  })();

  if (hasLoadedFull) {
    return (
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-[12px] text-[var(--text-muted)]">
        <div className="flex items-center gap-2 flex-wrap">
          <Database className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          <span>
            <span className="text-[var(--text-primary)] font-medium">
              {stats.totalSkus.toLocaleString()}
            </span>{' '}
            articles synced
            {salesData && (
              <>
                {' '}•{' '}
                <span className="text-[var(--text-primary)] font-medium">
                  {salesData.totalRows.toLocaleString()}
                </span>{' '}
                sales records ({salesData.minDate} to {salesData.maxDate})
              </>
            )}
            {isSyncingSales && !salesData && (
              <span className="ml-1.5">• Syncing sales sheet...</span>
            )}
            {formattedLastSync && (
              <span className="text-[var(--text-muted)] ml-1.5">• Last synced {formattedLastSync}</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {(syncError || salesSyncError) && (
            <span
              title={salesSyncError || syncError || undefined}
              className="text-[var(--text-primary)] font-medium flex items-center gap-1"
            >
              <AlertCircle className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>{salesSyncError ? 'Sales sync error' : 'Sync error'}</span>
            </span>
          )}
          <button
            onClick={handleDirectSync}
            disabled={isSyncing || isSyncingSales || !isOnline}
            className="px-2.5 py-1 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] disabled:opacity-40 text-[var(--text-primary)] font-medium flex items-center gap-1.5 transition-colors duration-150"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[var(--text-muted)] ${
                isSyncing || isSyncingSales ? 'animate-spin' : ''
              }`}
            />
            <span>{isSyncing || isSyncingSales ? 'Syncing...' : 'Refresh sheets'}</span>
          </button>
          <button
            onClick={onOpenSync}
            className="text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium transition-colors duration-150"
          >
            Manage links &amp; export →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border)] p-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-xl">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-[12px] font-medium text-[var(--text-muted)]">
              Direct Google Sheet link sync (3,285+ items)
            </span>
          </div>
          <h2 className="text-[14px] font-medium text-[var(--text-primary)]">
            Sync your live Google Sheet directly
          </h2>
          <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
            Currently showing{' '}
            <span className="text-[var(--text-primary)] font-medium">
              {stats.totalSkus.toLocaleString()}
            </span>{' '}
            items. Click Sync live sheet to pull all articles from your connected Google Sheet CSV link.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto shrink-0">
          <button
            onClick={handleDirectSync}
            disabled={isSyncing || !isOnline}
            className="px-3.5 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-white text-[13px] font-medium flex items-center justify-center gap-2 transition-colors duration-150"
          >
            <RefreshCw className={`w-4 h-4 text-white ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing sheet...' : 'Sync live sheet'}</span>
          </button>

          <label className="cursor-pointer px-3.5 py-2 rounded-lg bg-[var(--card-bg)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[13px] font-medium flex items-center justify-center gap-2 border border-[var(--border)] transition-colors duration-150">
            <Upload className="w-4 h-4 text-[var(--text-muted)]" />
            <span>Upload CSV</span>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={onOpenSync}
            className="px-3.5 py-2 rounded-lg bg-[var(--card-bg)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[13px] font-medium flex items-center justify-center gap-2 border border-[var(--border)] transition-colors duration-150"
          >
            <Link2 className="w-4 h-4 text-[var(--text-muted)]" />
            <span>Change link</span>
          </button>
        </div>
      </div>

      {(status || syncError) && (
        <div className="mt-3 p-3 rounded-lg text-[12px] font-medium flex items-center gap-2 bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border)]">
          {isError || syncError ? (
            <AlertCircle className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          ) : (
            <Check className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          )}
          <span>{status || syncError}</span>
        </div>
      )}
    </div>
  );
};
