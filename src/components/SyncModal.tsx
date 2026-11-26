import React, { useState, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { DEFAULT_PUBLISHED_SHEET_URL, DEFAULT_SALES_SHEET_URL } from '../utils/csvHelper';
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
  TrendingUp,
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
    salesData,
    connectedSalesUrl,
    isSyncingSales,
    salesSyncError,
    syncSalesSheet,
    importSalesCsvData,
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
  const [salesUrlInput, setSalesUrlInput] = useState(connectedSalesUrl);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [salesStatus, setSalesStatus] = useState<string | null>(null);
  const [isSalesError, setIsSalesError] = useState(false);

  useEffect(() => {
    setSheetUrlInput(connectedSheetUrl);
    setSalesUrlInput(connectedSalesUrl);
  }, [connectedSheetUrl, connectedSalesUrl, isOpen]);

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

  const handleSalesSync = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const urlToUse = salesUrlInput.trim();
    if (!urlToUse) {
      setIsSalesError(true);
      setSalesStatus('Please paste your Google Sheet sales CSV or share link.');
      return;
    }

    setIsSalesError(false);
    setSalesStatus('Fetching & aggregating sales data by Simplified name...');

    const res = await syncSalesSheet(urlToUse, { forceRefresh: true });
    if (res.success) {
      setIsSalesError(false);
      setSalesStatus(
        `Synced ${res.rows.toLocaleString()} sales rows across ${res.uniqueSimplified.toLocaleString()} Simplified products.`
      );
    } else {
      setIsSalesError(true);
      setSalesStatus(
        res.error || 'Could not load sales sheet. Make sure it is published to web as CSV.'
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

  const handleSalesFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSalesError(false);
    setSalesStatus(`Reading ${file.name}...`);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = importSalesCsvData(content, `CSV: ${file.name}`);
        if (res.success) {
          setIsSalesError(false);
          setSalesStatus(
            `Loaded ${res.rows.toLocaleString()} sales rows across ${res.uniqueSimplified.toLocaleString()} Simplified products.`
          );
        } else {
          setIsSalesError(true);
          setSalesStatus(res.error || 'Invalid Sales CSV format.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[var(--overlay-bg)]">
      <div className="w-full max-w-2xl bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--table-divider)] bg-[var(--card-bg)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--surface-subtle)] text-[var(--text-muted)] border border-[var(--border)]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-medium text-[var(--text-primary)]">
                Direct Google Sheet sync hub
              </h2>
              <p className="text-[12px] text-[var(--text-muted)]">
                Real-time CSV link sync with offline IndexedDB storage
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

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Connection Status Strip */}
          <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-[12px]">
              <span className="p-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text-muted)]">
                {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              </span>
              <div>
                <div className="font-medium text-[var(--text-primary)]">
                  {isOnline ? 'Online — Direct CSV link active' : 'Offline — Using local database'}
                </div>
                <div className="text-[12px] text-[var(--text-muted)]">
                  Last synced: {formattedLastSync} • {items.length.toLocaleString()} stock SKUs
                  {salesData && ` • ${salesData.totalRows.toLocaleString()} sales rows`}
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-[12px] text-[var(--text-primary)] font-normal cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSyncEnabled}
                onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              <span>Auto-sync on open</span>
            </label>
          </div>

          {/* Primary Method: Direct Published / Share Link Sync */}
          <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-[14px] font-medium text-[var(--text-primary)] flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[var(--text-muted)]" />
                  <span>Direct Google Sheet link</span>
                  <span className="text-[11px] bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)] px-2 py-0.5 rounded-full font-medium">
                    Connected
                  </span>
                </h3>
                <p className="text-[12px] text-[var(--text-muted)] mt-1">
                  Uses your published CSV link or public Google Sheet share URL directly:
                </p>
              </div>
              {sheetUrlInput !== DEFAULT_PUBLISHED_SHEET_URL && (
                <button
                  type="button"
                  onClick={() => setSheetUrlInput(DEFAULT_PUBLISHED_SHEET_URL)}
                  className="text-[12px] text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium shrink-0 transition-colors duration-150"
                >
                  Use default link
                </button>
              )}
            </div>

            <form onSubmit={(e) => handleDirectSync(e, true)} className="space-y-3">
              <input
                type="text"
                value={sheetUrlInput}
                onChange={(e) => setSheetUrlInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[12px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={isSyncing || isLoading || !isOnline}
                  className="px-4 py-2 rounded-lg bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] disabled:opacity-40 text-white text-[13px] font-medium flex items-center justify-center gap-2 transition-colors duration-150"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-white ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Syncing...' : 'Sync now (keep local edits)'}</span>
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
                    className="px-3.5 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] disabled:opacity-40 text-[var(--text-primary)] text-[13px] font-medium transition-colors duration-150"
                  >
                    Force pull all from sheet
                  </button>
                )}
              </div>
            </form>
          </div>

          {importStatus && (
            <div className="text-[12px] p-3.5 rounded-xl font-medium flex items-start gap-2.5 bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border)]">
              {isError ? (
                <AlertCircle className="w-4 h-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{importStatus}</span>
            </div>
          )}

          {/* Sales Data Google Sheet Sync */}
          <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-[14px] font-medium text-[var(--text-primary)] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[var(--text-muted)]" />
                  <span>Sales Google Sheet link (per Simplified)</span>
                  <span className="text-[11px] bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)] px-2 py-0.5 rounded-full font-medium">
                    {salesData ? 'Synced' : isSyncingSales ? 'Syncing...' : 'Not synced'}
                  </span>
                </h3>
                <p className="text-[12px] text-[var(--text-muted)] mt-1">
                  {salesData
                    ? `${salesData.totalRows.toLocaleString()} order rows (${salesData.minDate} to ${salesData.maxDate}) • ${salesData.uniqueSimplified.toLocaleString()} Simplified articles`
                    : 'Aggregates historical sales quantities per Simplified article name across 1M, 3M, 6M, 12M, and monthly filters.'}
                </p>
              </div>
              {salesUrlInput !== DEFAULT_SALES_SHEET_URL && (
                <button
                  type="button"
                  onClick={() => setSalesUrlInput(DEFAULT_SALES_SHEET_URL)}
                  className="text-[12px] text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium shrink-0 transition-colors duration-150"
                >
                  Use default link
                </button>
              )}
            </div>

            <form onSubmit={handleSalesSync} className="space-y-3">
              <input
                type="text"
                value={salesUrlInput}
                onChange={(e) => setSalesUrlInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                className="w-full bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[12px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={isSyncingSales || !isOnline}
                  className="px-3.5 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] disabled:opacity-40 text-[var(--text-primary)] text-[13px] font-medium flex items-center justify-center gap-2 transition-colors duration-150"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-[var(--text-muted)] ${isSyncingSales ? 'animate-spin' : ''}`}
                  />
                  <span>{isSyncingSales ? 'Syncing sales...' : 'Sync sales sheet'}</span>
                </button>

                <label className="cursor-pointer px-3.5 py-2 rounded-lg bg-[var(--card-bg)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[13px] font-medium flex items-center justify-center gap-2 border border-[var(--border)] transition-colors duration-150">
                  <Upload className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span>Upload Sales CSV</span>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleSalesFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </form>

            {(salesStatus || salesSyncError) && (
              <div className="text-[12px] p-3 rounded-lg font-medium flex items-start gap-2 bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border)]">
                {isSalesError || salesSyncError ? (
                  <AlertCircle className="w-4 h-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
                )}
                <span className="leading-relaxed">{salesStatus || salesSyncError}</span>
              </div>
            )}
          </div>

          {/* Export / Copy Edits Back to Master Sheet */}
          <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-medium text-[var(--text-primary)] flex items-center gap-2">
                <Copy className="w-4 h-4 text-[var(--text-muted)]" />
                <span>Update master Google Sheet (copy / export)</span>
              </h3>
              {modifiedCount > 0 && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]">
                  {modifiedCount} locally edited
                </span>
              )}
            </div>
            <p className="text-[12px] text-[var(--text-muted)]">
              Published CSV links are read-only from Google. Copy your updated rows here and paste into cell{' '}
              <code className="text-[var(--text-primary)] bg-[var(--surface-subtle)] px-1 py-0.5 rounded">A1</code> of your sheet:
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {modifiedCount > 0 && (
                <button
                  onClick={handleCopyModified}
                  className="px-3.5 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[13px] font-medium flex items-center gap-2 transition-colors duration-150"
                >
                  {copiedModified ? (
                    <>
                      <Check className="w-4 h-4 text-[var(--accent)]" />
                      <span>Copied {modifiedCount} modified rows</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-[var(--text-muted)]" />
                      <span>Copy {modifiedCount} modified rows</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={handleCopyAll}
                className="px-3.5 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[13px] font-medium flex items-center gap-2 transition-colors duration-150"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-[var(--accent)]" />
                    <span>Copied all {items.length.toLocaleString()} rows</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-[var(--text-muted)]" />
                    <span>Copy all {items.length.toLocaleString()} rows (TSV)</span>
                  </>
                )}
              </button>

              <button
                onClick={exportCsv}
                className="px-3.5 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[13px] font-medium flex items-center gap-2 transition-colors duration-150"
              >
                <Download className="w-4 h-4 text-[var(--text-muted)]" />
                <span>Download .CSV</span>
              </button>
            </div>
          </div>

          {/* Offline Backup: Direct CSV File Upload */}
          <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] space-y-3">
            <div>
              <h3 className="text-[14px] font-medium text-[var(--text-primary)] flex items-center gap-2">
                <Upload className="w-4 h-4 text-[var(--text-muted)]" />
                <span>Offline backup: upload .CSV file</span>
              </h3>
              <p className="text-[12px] text-[var(--text-muted)] mt-1">
                Import a downloaded <span className="font-medium text-[var(--text-primary)]">.csv</span> file directly anytime, even without internet access:
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <label className="cursor-pointer px-3.5 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[13px] font-medium flex items-center gap-2 transition-colors duration-150">
                <Upload className="w-4 h-4 text-[var(--text-muted)]" />
                <span>Upload CSV file</span>
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
          <div className="flex items-center justify-between pt-1 text-[12px]">
            <span className="text-[var(--text-muted)]">Need to restore initial sample records?</span>
            <button
              onClick={() => {
                if (window.confirm('Reset inventory database to initial seed sample?')) {
                  resetToDefault();
                  setImportStatus('Reset successfully to default sample stock data.');
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-[var(--card-bg)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] border border-[var(--border)] transition-colors duration-150 flex items-center gap-1.5 font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>Reset to sample data</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--table-divider)] bg-[var(--card-bg)] flex items-center justify-between">
          <div className="text-[12px] text-[var(--text-muted)]">
            Database holds{' '}
            <span className="text-[var(--text-primary)] font-medium">
              {items.length.toLocaleString()}
            </span>{' '}
            articles
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-hover)] text-[var(--text-primary)] text-[13px] font-medium transition-colors duration-150"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
