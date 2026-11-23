import React, { useState } from 'react';
import { ExternalLink, Package } from 'lucide-react';
import { isWebpageLink, getColorHex } from '../utils/imageHelper';

interface ItemImageProps {
  url: string;
  rawLink?: string;
  name: string;
  itemCategory: string;
  color: string;
  className?: string;
  onClick?: () => void;
}

export const ItemImage: React.FC<ItemImageProps> = ({
  url,
  rawLink,
  name,
  itemCategory,
  color,
  className = 'w-16 h-16',
  onClick,
}) => {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const isWeb = isWebpageLink(rawLink);
  const accentColor = getColorHex(color);

  // If no direct image URL or already encountered load error
  if (!url || error) {
    return (
      <div
        onClick={onClick}
        className={`relative flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-800 p-1 overflow-hidden transition-all hover:border-slate-600 ${className} ${
          onClick ? 'cursor-pointer hover:ring-2 hover:ring-indigo-500/30' : ''
        }`}
        style={{
          background: `radial-gradient(circle at top right, ${accentColor}25, #1e293b)`,
        }}
      >
        <div
          className="w-3.5 h-3.5 rounded-full mb-1 shadow-sm border border-white/20"
          style={{ backgroundColor: accentColor }}
          title={`Color: ${color}`}
        />
        <span className="text-[10px] font-bold text-slate-300 text-center line-clamp-1 px-1">
          {itemCategory.slice(0, 8)}
        </span>
        {isWeb && rawLink ? (
          <a
            href={rawLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-1 right-1 text-slate-400 hover:text-indigo-400 p-0.5 rounded bg-slate-900/80 shadow-xs border border-slate-700"
            title="Open product store link"
          >
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        ) : (
          <Package className="w-3 h-3 text-slate-500 mt-0.5" />
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`relative rounded-xl border border-slate-700/80 bg-slate-800 overflow-hidden flex items-center justify-center transition-all ${className} ${
        onClick ? 'cursor-pointer hover:border-indigo-400 hover:shadow-md' : ''
      }`}
    >
      {!loaded && (
        <div className="absolute inset-0 bg-slate-800 animate-pulse flex items-center justify-center">
          <div className="w-4 h-4 rounded-full border-2 border-indigo-400/30 border-t-indigo-400 animate-spin" />
        </div>
      )}
      <img
        src={url}
        alt={name}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`w-full h-full object-cover transition-transform duration-300 ${
          loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        } ${onClick ? 'hover:scale-105' : ''}`}
      />
      {/* Subtle color swatch in corner */}
      {color && color !== 'Standard' && (
        <span
          className="absolute bottom-1 left-1 w-3 h-3 rounded-full border border-black/30 shadow-xs"
          style={{ backgroundColor: accentColor }}
          title={`Color: ${color}`}
        />
      )}
    </div>
  );
};
