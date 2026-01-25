/**
 * Utility functions for the scraper
 * Extracted for testability
 */

/**
 * Convert a simple glob pattern to a RegExp
 * Supports: * (any chars except /), ** (any chars including /), ? (single char)
 */
export function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex special chars (except * and ?)
    .replace(/\*\*/g, '{{GLOBSTAR}}')       // Temp placeholder for **
    .replace(/\*/g, '[^/]*')                // * matches anything except /
    .replace(/\?/g, '[^/]')                 // ? matches single char except /
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');    // ** matches anything including /
  return new RegExp(`^${escaped}$`);
}

/**
 * Transform Tilda placeholder image URLs to actual image URLs
 * thb.tildacdn.com/tildXXXX/-/empty/image.png -> static.tildacdn.com/tildXXXX/image.png
 */
export function transformTildaImageUrl(url: string): string {
  if (url.includes('tildacdn.com') && url.includes('/-/empty/')) {
    const match = url.match(/\/(tild[^/]+)\/-\/empty\/(.+)$/);
    if (match) {
      return `https://static.tildacdn.com/${match[1]}/${match[2]}`;
    }
  }
  return url;
}

/**
 * Create a safe filename from a title
 */
export function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

/**
 * Extract the base URL (protocol + host) from a full URL
 */
export function getBaseUrl(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}

/**
 * Generate a markdown anchor from a heading title
 * Matches the anchor generation used by most markdown processors (GitHub/CommonMark style)
 */
export function generateAnchor(title: string): string {
  return title
    .toLowerCase()
    .replace(/ /g, '-')                    // Replace spaces with hyphens
    .replace(/[^a-zа-яё0-9-]/gi, '')       // Remove non-alphanumeric except hyphens
    .replace(/^-+|-+$/g, '');              // Strip leading/trailing hyphens
}

/**
 * Deduplicate content parts by comparing text content (or image src for images)
 * This is used to remove duplicate blocks that Tilda creates for responsive design
 *
 * Note: This function is designed to work in browser context (page.evaluate)
 * but is also exported for testing with jsdom
 */
export function deduplicateContentParts(contentParts: string[]): string[] {
  const seen = new Set<string>();
  return contentParts.filter(part => {
    const trimmed = part.trim();
    if (!trimmed) return false;

    // Create a temporary element to extract content for comparison
    // In browser context, this uses the DOM; in tests, use jsdom
    const temp = typeof document !== 'undefined'
      ? document.createElement('div')
      : createElementFromHTML(trimmed);

    if (typeof document !== 'undefined') {
      temp.innerHTML = trimmed;
    }

    // For images, use src as the key; for text content, use the text
    const img = temp.querySelector('img');
    const textKey = img
      ? (img.getAttribute('src') || '')
      : (temp.textContent?.trim() || '');

    if (!textKey || seen.has(textKey)) return false;
    seen.add(textKey);
    return true;
  });
}

/**
 * Helper to create an element from HTML string (for testing outside browser)
 * This is a minimal implementation - tests should use jsdom for full support
 */
function createElementFromHTML(html: string): Element {
  // Minimal parsing for test purposes
  const div = {
    innerHTML: '',
    textContent: '',
    querySelector: (selector: string) => {
      if (selector === 'img' && html.includes('<img')) {
        const srcMatch = html.match(/src="([^"]+)"/);
        return srcMatch ? { getAttribute: (attr: string) => attr === 'src' ? srcMatch[1] : null } : null;
      }
      return null;
    }
  };
  div.innerHTML = html;
  // Extract text content by stripping HTML tags
  div.textContent = html.replace(/<[^>]*>/g, '').trim();
  return div as unknown as Element;
}
