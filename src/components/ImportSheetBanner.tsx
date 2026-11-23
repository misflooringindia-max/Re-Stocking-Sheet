import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { 
  FileSpreadsheet, 
  Upload, 
  Link2, 
  Check, 
  AlertCircle, 
  Sparkles,
  ArrowRight,
  Database
} from 'lucide-react';

interface ImportSheetBannerProps {
  onOpenSync: () => void;
}

export const ImportSheetBanner: React.FC<ImportSheetBannerProps> = ({ onOpenSync }) => {
  const { stats, importCsvData, importFromGoogleSheetUrl, isLoading } = useInventory();
  const [sheetUrl, setSheetUrl] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // If user already loaded more than 1000 items, keep banner subtle
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
          setStatus(`🎉 Success! Loaded all ${res.count.toLocaleString()} items from your spreadsheet.`);
        } else {
          setIsError(true);
          setStatus(res.error || 'Failed to parse spreadsheet file.');
        }
      }
    };
    reader.readAsText(file);
  };

  const handleUrlSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetUrl.trim()) return;

    setStatus('Fetching full sheet records...');
    const res = await importFromGoogleSheetUrl(sheetUrl);
    if (res.success) {
      setIsError(false);
      setStatus(`🎉 Success! Loaded all ${res.count.toLocaleString()} products directly from your Google Sheet.`);
      setSheetUrl('');
    } else {
      setIsError(true);
      setStatus(res.error || 'Failed to fetch spreadsheet. Make sure sheet is shared with "Anyone with link can view"');
    }
  };

  if (hasLoadedFull && !isExpanded) {
    return (
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-400" />
          <span>
            <strong className="text-white font-bold">{stats.totalSkus.toLocaleString()}</strong> articles active in database.
          </span>
        </div>
        <button
          onClick={() => setIsExpanded(true)}
          className="text-indigo-400 hover:text-indigo-300 font-bold"
        >
          Update or Sync Sheet →
        </button>
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
              Complete Catalogue Loader (3,500+ Items)
            </span>
          </div>
          <h2 className="text-sm sm:text-base font-extrabold text-white">
            Ready to load your entire 3,500+ products spreadsheet?
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Currently showing <strong className="text-amber-300 font-bold">{stats.totalSkus}</strong> items.
            Upload your full Google Sheet (.csv) or paste your Google Sheet link to import all 3,500+ articles instantly with persistent offline storage.
          </p>
        </div>

        {/* Quick Upload & Paste Link Form */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto shrink-0">
          {/* File Picker button */}
          <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30 transition-all">
            <Upload className="w-4 h-4" />
            <span>Upload Full 3500+ CSV File</span>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* Or Connect URL */}
          <button
            onClick={onOpenSync}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 transition-colors"
          >
            <Link2 className="w-4 h-4 text-sky-400" />
            <span>Google Sheet URL Sync</span>
          </button>
        </div>
      </div>

      {status && (
        <div
          className={`mt-3 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            isError
              ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
              : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
          }`}
        >
          {isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
          <span>{status}</span>
        </div>
      )}
    </div>
  );
};
