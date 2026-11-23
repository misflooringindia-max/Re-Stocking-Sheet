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
    connectedSheetUrl,
    lastSyncTime,
    isSyncing,
    isOnline,
    syncError,
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
    setStatus('Syncing latest articles from Google Sheet...');
    setIsError(false);
    const res = await syncFromLiveSheet(connectedSheetUrl);
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
      <div className="bg-slate-800/70 border border-slate-700/70 rounded-xl px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong className="text-white font-bold">{stats.totalSkus.toLocaleString()}</strong> articles synced
            via direct Google Sheet link
            {formattedLastSync && (
              <span className="text-slate-400 ml-1.5">• Last synced {formattedLastSync}</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {syncError && (
            <span className="text-rose-400 font-semibold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Sync error
            </span>
          )}
          <button
            onClick={handleDirectSync}
            disabled={isSyncing || !isOnline}
            className="text-emerald-400 hover:text-emerald-300 disabled:opacity-40 font-bold flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Refresh Sheet'}</span>
          </button>
          <button
            onClick={onOpenSync}
            className="text-indigo-400 hover:text-indigo-300 font-bold"
          >
            Manage Link & Export →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/70 via-slate-850 to-slate-900 border border-indigo-500/30 p-4 sm:p-5 shadow-lg">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-indigo-500/20 text-indigo-400">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              Direct Google Sheet Link Sync (3,285+ Items)
            </span>
          </div>
          <h2 className="text-sm sm:text-base font-extrabold text-white">
            Sync your live Google Sheet directly
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Currently showing <strong className="text-amber-300 font-bold">{stats.totalSkus.toLocaleString()}</strong> items.
            Click <strong>Sync Live Sheet</strong> to pull all articles from your connected direct Google Sheet CSV link.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto shrink-0">
          <button
            onClick={handleDirectSync}
            disabled={isSyncing || !isOnline}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing Sheet...' : 'Sync Live Sheet Now'}</span>
          </button>

          <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 transition-colors">
            <Upload className="w-4 h-4 text-sky-400" />
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
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 transition-colors"
          >
            <Link2 className="w-4 h-4 text-emerald-400" />
            <span>Change Link</span>
          </button>
        </div>
      </div>

      {(status || syncError) && (
        <div
          className={`mt-3 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            isError || syncError
              ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
              : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
          }`}
        >
          {isError || syncError ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <Check className="w-4 h-4 shrink-0" />
          )}
          <span>{status || syncError}</span>
        </div>
      )}
    </div>
  );
};
