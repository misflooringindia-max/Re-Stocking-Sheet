import React, { useState, useRef, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  value: string | number;
  label?: string;
  className?: string;
  size?: 'xs' | 'sm';
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.className = 'fixed -top-[9999px] -left-[9999px] opacity-0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  value,
  label = 'Copy',
  className = '',
  size = 'xs',
}) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const text = String(value ?? '');
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopied(true);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        setCopied(false);
        timerRef.current = null;
      }, 1400);
    }
  };

  const sizeClasses = size === 'sm' ? 'w-6 h-6 rounded-md' : 'w-5 h-5 rounded-md';
  const iconClasses = size === 'sm' ? 'w-3.5 h-3.5' : 'w-3 h-3';

  return (
    <button
      type="button"
      onClick={handleCopy}
      onMouseDown={(e) => e.stopPropagation()}
      title={copied ? 'Copied!' : label}
      aria-label={copied ? 'Copied' : label}
      className={`inline-flex items-center justify-center shrink-0 border transition-all duration-150 ${sizeClasses} ${
        copied
          ? '!opacity-100 bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]'
          : `bg-[var(--card-bg)] text-[var(--text-muted)] border-[var(--border)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] hover:border-[var(--accent)] ${className}`
      }`}
    >
      {copied ? <Check className={iconClasses} /> : <Copy className={iconClasses} />}
    </button>
  );
};
