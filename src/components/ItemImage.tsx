import React, { useState } from 'react';
import { ExternalLink, Package } from 'lucide-react';
import { isWebpageLink } from '../utils/imageHelper';

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
  className = 'w-16 h-16',
  onClick,
}) => {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const isWeb = isWebpageLink(rawLink);

  // If no direct image URL or already encountered load error
  if (!url || error) {
    return (
      <div
        onClick={onClick}
        className={`relative flex flex-col items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-1.5 overflow-hidden transition-colors duration-150 ${className} ${
          onClick ? 'cursor-pointer hover:border-[var(--accent)]' : ''
        }`}
      >
        <Package className="w-4 h-4 text-[var(--text-muted)] mb-1" />
        <span className="text-[10px] font-medium text-[var(--text-muted)] text-center line-clamp-1 px-0.5">
          {itemCategory.slice(0, 8)}
        </span>
        {isWeb && rawLink && (
          <a
            href={rawLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-1 right-1 text-[var(--text-muted)] hover:text-[var(--accent)] p-0.5 rounded bg-[var(--card-bg)] border border-[var(--border)] transition-colors duration-150"
            title="Open product store link"
          >
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`relative rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] overflow-hidden flex items-center justify-center transition-colors duration-150 ${className} ${
        onClick ? 'cursor-pointer hover:border-[var(--accent)]' : ''
      }`}
    >
      {!loaded && (
        <div className="absolute inset-0 bg-[var(--surface-subtle)] flex items-center justify-center">
          <Package className="w-4 h-4 text-[var(--text-muted)]" />
        </div>
      )}
      <img
        src={url}
        alt={name}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`w-full h-full object-cover transition-opacity duration-150 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};
