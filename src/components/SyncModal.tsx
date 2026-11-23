import React, { useState, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { DEFAULT_PUBLISHED_SHEET_URL } from '../utils/csvHelper';
import {
  X,
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  Upload,
  RotateCcw,
  Link2,
  RefreshCw,
  AlertCircle,
  Wifi,
  WifiOff,
  CheckCircle2,
} from 'lucide-react';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({ isOpen, onClose }) => {
  const {
    items,
    exportCsv,
    copyTsvToClipboard,
    copyModifiedTsvToClipboard,
    clearModifiedFlags,
    modifiedCount,
    importCsvData,
    syncFromLiveSheet,
    connectedSheetUrl,
    autoSyncEnabled,
    setAutoSyncEnabled,
    isSyncing,
    isOnline,
    lastSyncTime,
    resetToDefault,
    isLoading,
  } = useInventory();

  const [copied, setCopied] = useState(false);
  const [copiedModified, setCopiedModified] = useState(false);
  const [sheetUrlInput, setSheetUrlInput] = useState(connectedSheetUrl);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    setSheetUrlInput(connectedSheetUrl);
  }, [connectedSheetUrl, isOpen]);

  if (!isOpen) return null;

  const handleCopyAll = async () => {
    const success = await copyTsvToClipboard();
    if (success) {
      setCopied(true);
      clearModifiedFlags();
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleCopyModified = async () => {
    const success = await copyModifiedTsvToClipboard();
    if (success) {
      setCopiedModified(true);
      setTimeout(() => setCopiedModified(false), 2500);
    }
  };

  const handleDirectSync = async (e?: React.FormEvent, preserveLocalEdits = true) => {
    if (e) e.preventDefault();
    const urlToUse = sheetUrlInput.trim();
    if (!urlToUse) {
      setIsError(true);
      setImportStatus('Please paste your Google Sheet direct CSV or share link.');
      return;
    }

    setIsError(false);
    setImportStatus('Fetching live inventory data from your Google Sheet...');

    const res = await syncFromLiveSheet(urlToUse, { preserveLocalEdits });
    if (res.success) {
      setIsError(false);
      const changeInfo =
        res.changedCount && res.changedCount > 0
          ? ` (${res.changedCount.toLocaleString()} updated/new)`
          : ' (all records up to date)';
      setImportStatus(`Synced ${res.count.toLocaleString()} articles from Google Sheet${changeInfo}.`);
    } else {
      setIsError(true);
      setImportStatus(
        res.error || 'Could not load sheet. Make sure the link is published to web as CSV or shared publicly.'
      );
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus(`Reading ${file.name}...`);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = importCsvData(content);
        if (res.success) {
          setIsError(false);
          setImportStatus(`Successfully imported all ${res.count.toLocaleString()} articles into database.`);
        } else {
          setIsError(true);
          setImportStatus(res.error || 'Invalid CSV format.');
        }
      }
    };
    reader.readAsText(file);
  };

  const formattedLastSync = (() => {
    try {
      return new Date(lastSyncTime).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return lastSyncTime;
    }
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-700/80 bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                Direct Google Sheet Sync Hub
              </h2>
              <p className="text-xs text-slate-400">
                Real-time CSV link sync with offline IndexedDB storage — no sign-in required
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Connection Status Strip */}
          <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs">
              {isOnline ? (
                <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Wifi className="w-4 h-4" />
                </span>
              ) : (
                <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                  <WifiOff className="w-4 h-4" />
                </span>
              )}
              <div>
                <div className="font-bold text-white">
                  {isOnline ? 'Online — Direct CSV Link Active' : 'Offline — Using Local Database'}
                </div>
                <div className="text-[11px] text-slate-400">
                  Last synced: {formattedLastSync} • {items.length.toLocaleString()} total products
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSyncEnabled}
                onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                className="rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
              />
              <span>Auto-sync on open</span>
            </label>
          </div>

          {/* Primary Method: Direct Published / Share Link Sync */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-800/90 to-slate-800/90 border border-indigo-500/40 space-y-3.5 shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-indigo-400" />
                  <span>Direct Google Sheet Link</span>
                  <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">
                    Connected
                  </span>
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Uses your published CSV link or public Google Sheet share URL directly:
                </p>
              </div>
              {sheetUrlInput !== DEFAULT_PUBLISHED_SHEET_URL && (
                <button
                  type="button"
                  onClick={() => setSheetUrlInput(DEFAULT_PUBLISHED_SHEET_URL)}
                  className="text-[11px] text-indigo-300 hover:text-indigo-200 font-semibold shrink-0"
                >
                  Use Default Link
                </button>
              )}
            </div>

            <form onSubmit={(e) => handleDirectSync(e, true)} className="space-y-2.5">
              <input
                type="text"
                value={sheetUrlInput}
                onChange={(e) => setSheetUrlInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-inner"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={isSyncing || isLoading || !isOnline}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/30"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Syncing...' : 'Sync Now (Keep Local Edits)'}</span>
                </button>

                {modifiedCount > 0 && (
                  <button
                    type="button"
                    disabled={isSyncing || isLoading || !isOnline}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Overwrite ${modifiedCount} locally edited item(s) with the latest values from your Google Sheet?`
                        )
                      ) {
                        handleDirectSync(undefined, false);
                      }
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 text-xs font-semibold transition-all"
                  >
                    Force Pull All from Sheet
                  </button>
                )}
              </div>
            </form>
          </div>

          {importStatus && (
            <div
              className={`text-xs p-3.5 rounded-xl font-bold flex items-start gap-2.5 ${
                isError
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                  : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
              }`}
            >
              {isError ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{importStatus}</span>
            </div>
          )}

          {/* Export / Copy Edits Back to Master Sheet */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Copy className="w-4 h-4 text-indigo-400" />
                <span>Update Master Google Sheet (Copy / Export)</span>
              </h3>
              {modifiedCount > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {modifiedCount} locally edited
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Published CSV links are read-only from Google. Copy your updated rows here and paste (`Ctrl+V`) into cell <code className="text-slate-200">A1</code> of your sheet:
            </p>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {modifiedCount > 0 && (
                <button
                  onClick={handleCopyModified}
                  className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-xs"
                >
                  {copiedModified ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied {modifiedCount} Modified Rows!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy {modifiedCount} Modified Rows</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={handleCopyAll}
                className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold flex items-center gap-2 transition-all border border-slate-600 shadow-xs"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">
                      Copied All {items.length.toLocaleString()} Rows!
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy All {items.length.toLocaleString()} Rows (TSV)</span>
                  </>
                )}
              </button>

              <button
                onClick={exportCsv}
                className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-600 shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Download .CSV</span>
              </button>
            </div>
          </div>

          {/* Offline Backup: Direct CSV File Upload */}
          <div className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700 space-y-3 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-sky-400" />
                <span>Offline Backup: Upload .CSV File</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Import a downloaded <strong>.csv</strong> file directly anytime, even without internet access:
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-xs">
                <Upload className="w-4 h-4" />
                <span>Upload CSV File</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Reset to Sample */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-slate-400 font-medium">Need to restore initial sample records?</span>
            <button
              onClick={() => {
                if (window.confirm('Reset inventory database to initial seed sample?')) {
                  resetToDefault();
                  setImportStatus('Reset successfully to default sample stock data.');
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/50 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800 transition-colors flex items-center gap-1.5 font-semibold shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Sample Data</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700/80 bg-slate-900 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Database holds <strong className="text-white">{items.length.toLocaleString()}</strong> articles
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
