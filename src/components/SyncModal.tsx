import React, { useState, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
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
  LogIn,
  LogOut,
  Send,
  ExternalLink,
  Layers,
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
    importCsvData,
    connectAndSyncWithGoogleAccount,
    pushChangesToGoogleSheet,
    googleUser,
    handleGoogleLogin,
    handleGoogleLogout,
    connectedSheetId,
    connectedSheetTitle,
    availableTabs,
    selectedTab,
    setSelectedTab,
    resetToDefault,
    lastSyncTime,
    isLoading,
  } = useInventory();

  const [copied, setCopied] = useState(false);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  useEffect(() => {
    if (connectedSheetId && !googleSheetUrl) {
      setGoogleSheetUrl(`https://docs.google.com/spreadsheets/d/${connectedSheetId}/edit`);
    }
  }, [connectedSheetId]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    const success = await copyTsvToClipboard();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleGoogleSync = async (e?: React.FormEvent, tabTitle?: string) => {
    if (e) e.preventDefault();
    const urlToUse = googleSheetUrl.trim();
    if (!urlToUse) {
      setIsError(true);
      setImportStatus('Please paste your Google Sheet link or ID first.');
      return;
    }

    setIsSyncing(true);
    setImportStatus('Connecting to Google Sheets and reading articles...');

    const res = await connectAndSyncWithGoogleAccount(urlToUse, tabTitle || selectedTab || undefined);
    setIsSyncing(false);

    if (res.success) {
      setIsError(false);
      setImportStatus(`🎉 Successfully synced! Loaded all ${res.count.toLocaleString()} articles directly from your Google Sheet.`);
    } else {
      setIsError(true);
      setImportStatus(res.error || 'Could not access spreadsheet. If private, please ensure you sign in with your Google account.');
    }
  };

  const handlePushBack = async () => {
    if (!connectedSheetId) {
      setIsError(true);
      setImportStatus('Please connect and sync your Google Sheet first.');
      return;
    }

    const confirmed = window.confirm(
      `Sync all ${items.length.toLocaleString()} articles back to Google Sheet (${connectedSheetTitle || connectedSheetId})? This will update the STOCK and Simplified columns in your spreadsheet.`
    );
    if (!confirmed) return;

    setIsPushing(true);
    setImportStatus('Writing master record changes back to Google Sheet...');
    const res = await pushChangesToGoogleSheet();
    setIsPushing(false);

    if (res.success) {
      setIsError(false);
      setImportStatus(`🎉 Updated ${res.count.toLocaleString()} rows in your Google Sheet successfully!`);
    } else {
      setIsError(true);
      setImportStatus(res.error || 'Failed to update Google Sheet. Please check permissions.');
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
          setImportStatus(`🎉 Successfully imported all ${res.count.toLocaleString()} articles into database!`);
        } else {
          setIsError(true);
          setImportStatus(res.error || 'Invalid CSV format.');
        }
      }
    };
    reader.readAsText(file);
  };

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
                Google Sheets Live Sync Hub
              </h2>
              <p className="text-xs text-slate-400">
                Sync all 3,500+ articles directly with your Google Sheet in real time
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
          {/* Google Account Authentication Strip */}
          <div className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              {googleUser ? (
                <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-xs uppercase">
                  {googleUser.email?.slice(0, 2) || 'GU'}
                </div>
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-700 text-slate-400 flex items-center justify-center">
                  <LogIn className="w-4 h-4" />
                </div>
              )}
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>
                    {googleUser
                      ? `Connected: ${googleUser.email || googleUser.displayName}`
                      : 'Google Account: Not Connected'}
                  </span>
                  {googleUser && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                </div>
                <div className="text-[11px] text-slate-400">
                  {googleUser
                    ? 'Authorized for Google Sheets live read & update'
                    : 'Sign in with your Google account to grant Google Sheets API access'}
                </div>
              </div>
            </div>

            <div>
              {googleUser ? (
                <button
                  onClick={handleGoogleLogout}
                  className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              ) : (
                /* Official GSI Style Button */
                <button
                  onClick={handleGoogleLogin}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                >
                  <svg className="w-4 h-4" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  <span>Sign in with Google</span>
                </button>
              )}
            </div>
          </div>

          {/* Primary Method: Google Sheets Live Sync */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-800/90 to-slate-800/90 border border-indigo-500/40 space-y-3.5 shadow-md">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-indigo-400" />
                  <span>Connect Google Spreadsheet</span>
                  <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold">
                    Direct API
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Paste your Google Sheet link or ID below to load all 3,500+ articles:
              </p>
            </div>

            <form onSubmit={handleGoogleSync} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={googleSheetUrl}
                onChange={(e) => setGoogleSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1CALrK7itJNNGiMapwCM.../edit"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-inner"
              />
              <button
                type="submit"
                disabled={isSyncing || isLoading}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 shrink-0 transition-all shadow-md shadow-indigo-600/30"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sync & Load All Items</span>
                  </>
                )}
              </button>
            </form>

            {/* Sheet Tabs Selector if multiple tabs detected */}
            {availableTabs.length > 1 && (
              <div className="pt-2 border-t border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  Sheet Tab:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {availableTabs.map((tab) => (
                    <button
                      key={tab.sheetId}
                      type="button"
                      onClick={() => {
                        setSelectedTab(tab.title);
                        handleGoogleSync(undefined, tab.title);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        selectedTab === tab.title
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-700/70 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {tab.title} {tab.rowCount > 0 ? `(${tab.rowCount.toLocaleString()} rows)` : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {connectedSheetId && (
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs border-t border-slate-700/60 text-slate-300">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <Check className="w-3.5 h-3.5" />
                  Connected: {connectedSheetTitle || connectedSheetId.slice(0, 16)}...
                </span>

                <button
                  type="button"
                  onClick={handlePushBack}
                  disabled={isPushing}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isPushing ? 'Writing changes...' : 'Push Updates to Google Sheet'}</span>
                </button>
              </div>
            )}
          </div>

          {importStatus && (
            <div
              className={`text-xs p-3.5 rounded-xl font-bold flex items-start gap-2.5 ${
                isError
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                  : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
              }`}
            >
              {isError ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <Check className="w-4 h-4 shrink-0 mt-0.5" />}
              <span className="leading-relaxed">{importStatus}</span>
            </div>
          )}

          {/* Backup Method 2: Direct CSV File Upload (100% Offline Guaranteed) */}
          <div className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700 space-y-3 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-sky-400" />
                <span>Backup Method: Upload Google Sheet .CSV File</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                In your Google Sheet, click <strong>File → Download → Comma Separated Values (.csv)</strong> and upload it here:
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-xs">
                <Upload className="w-4 h-4" />
                <span>Upload Downloaded CSV File</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <span className="text-xs text-slate-400">Instantly imports all 3,500+ items directly into local database</span>
            </div>
          </div>

          {/* Copy All Data to Clipboard */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Copy className="w-4 h-4 text-indigo-400" />
              <span>Copy Data to Paste in Google Sheet (Ctrl+V)</span>
            </h3>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={handleCopy}
                className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold flex items-center gap-2 transition-all border border-slate-600 shadow-xs"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copied All {items.length.toLocaleString()} Rows!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy All Rows (TSV format)</span>
                  </>
                )}
              </button>

              <button
                onClick={exportCsv}
                className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-600 shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Download .CSV Export</span>
              </button>
            </div>
          </div>

          {/* Reset to Sample */}
          <div className="flex items-center justify-between pt-2 text-xs">
            <span className="text-slate-400 font-medium">Need to restore seed sample records?</span>
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
