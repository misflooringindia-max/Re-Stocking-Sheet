/**
 * Utility to resolve, convert, and format diverse image URLs from Google Sheets
 * Handles Google Drive, Dropbox, Amazon CDN, Myntra, Flipkart, and fallbacks.
 */

export function resolveImageUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim();
  if (!url || url === '#N/A' || url === '#REF!' || url.toLowerCase() === 'no data') {
    return '';
  }

  // Extract URL from =IMAGE("https://...") or =IMAGE('...') formula
  const formulaMatch = url.match(/=IMAGE\(["']([^"']+)["']/i);
  if (formulaMatch && formulaMatch[1]) {
    url = formulaMatch[1].trim();
  }

  // 1. Google Drive links: https://drive.google.com/file/d/{FILE_ID}/view?usp=drive_link
  const gdriveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
  const gdriveMatch = url.match(gdriveRegex);
  if (gdriveMatch && gdriveMatch[1]) {
    const fileId = gdriveMatch[1];
    // Google Drive direct image thumbnail endpoint with high quality
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
  }

  // Also check other Google Drive formats: drive.google.com/open?id={FILE_ID} or ?id={FILE_ID}
  const gdriveIdMatch = url.match(/drive\.google\.com\/(?:open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/);
  if (gdriveIdMatch && gdriveIdMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${gdriveIdMatch[1]}&sz=w800`;
  }

  // 2. Dropbox links: convert dl=0 to raw=1 for direct binary image streaming
  if (url.includes('dropbox.com')) {
    if (url.includes('dl=0')) {
      return url.replace('dl=0', 'raw=1');
    }
    if (!url.includes('raw=1')) {
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}raw=1`;
    }
    return url;
  }

  // 3. Myntra / Insecure HTTP assets: upgrade to HTTPS to avoid browser mixed content block
  if (url.startsWith('http://assets.myntassets.com')) {
    return url.replace('http://', 'https://');
  }

  // 4. Check if the link is a store product webpage instead of an image
  // (e.g. https://www.ajio.com/p/... or https://www.meesho.com/search?q=...)
  if (url.includes('ajio.com/p/') || url.includes('meesho.com/search')) {
    return ''; // Webpage link, not direct image
  }

  // 5. Amazon, Flipkart, direct CDN URLs
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }

  return url;
}

export function isDirectImageLink(url?: string): boolean {
  if (!url) return false;
  const resolved = resolveImageUrl(url);
  return Boolean(resolved && resolved.startsWith('http'));
}

export function isWebpageLink(url?: string): boolean {
  if (!url) return false;
  return url.includes('ajio.com/p/') || url.includes('meesho.com/search');
}

/**
 * Returns a consistent visual accent color based on item color or category
 */
export function getColorHex(colorName: string): string {
  const c = (colorName || '').toLowerCase().trim();
  const colorMap: Record<string, string> = {
    green: '#16a34a',
    'hunter green': '#14532d',
    'forest green': '#166534',
    'sea green': '#0d9488',
    'pastel green': '#4ade80',
    blue: '#2563eb',
    'navy': '#1e3a8a',
    'sky blue': '#38bdf8',
    'sky': '#38bdf8',
    'aqua': '#06b6d4',
    'sea blue': '#0284c7',
    'dark blue': '#1e40af',
    brown: '#92400e',
    choco: '#78350f',
    chocolate: '#78350f',
    coffee: '#451a03',
    'arabic coffee': '#3f1d0b',
    cocoa: '#5c2c16',
    gold: '#eab308',
    'anti gold': '#ca8a04',
    'amber': '#d97706',
    'amber gold': '#d97706',
    yellow: '#eab308',
    grey: '#64748b',
    gray: '#64748b',
    'dark grey': '#334155',
    'light grey': '#94a3b8',
    silver: '#cbd5e1',
    anthra: '#1e293b',
    black: '#0f172a',
    red: '#dc2626',
    'royal red': '#991b1b',
    'pastel red': '#f87171',
    maroon: '#881337',
    wine: '#701a75',
    purple: '#9333ea',
    lavender: '#c084fc',
    lilac: '#c084fc',
    pink: '#ec4899',
    peach: '#fb923c',
    'pastel peach': '#fdba74',
    orange: '#ea580c',
    beige: '#d4b996',
    'light beige': '#e6d5bc',
    taupe: '#a89f91',
    terracotta: '#c2410c',
    rust: '#b45309',
    white: '#f8fafc',
    cream: '#fef3c7',
    natural: '#d6c5ad',
    cappuccino: '#854d0e',
    skin: '#fed7aa',
    teal: '#0d9488',
    multicolor: '#8b5cf6',
    multi: '#8b5cf6',
  };

  return colorMap[c] || '#6366f1';
}
