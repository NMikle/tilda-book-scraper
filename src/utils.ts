/**
 * Utility functions for the scraper
 * Extracted for testability
 */

/**
 * Convert a simple glob pattern to a RegExp.
 * Supports: * (any chars except /), ** (any chars including /), ? (single char)
 *
 * @param pattern - Glob pattern to convert
 * @returns RegExp that matches the pattern
 *
 * @example
 * globToRegex('*.html').test('page.html') // true
 * globToRegex('**\/page*.html').test('https://example.com/page1.html') // true
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
 * Transform Tilda placeholder image URLs to actual image URLs.
 * Converts thb.tildacdn.com placeholder URLs to static.tildacdn.com actual image URLs.
 *
 * @param url - Image URL to transform
 * @returns Transformed URL pointing to actual image, or original URL if not a placeholder
 *
 * @example
 * transformTildaImageUrl('https://thb.tildacdn.com/tild1234/-/empty/photo.jpg')
 * // Returns: 'https://static.tildacdn.com/tild1234/photo.jpg'
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
 * Create a safe filename from a title.
 * Converts to lowercase, replaces special characters with dashes,
 * and truncates to 50 characters.
 *
 * @param title - Title to convert to filename
 * @returns Sanitized filename safe for filesystem use
 *
 * @example
 * sanitizeFilename('Chapter 1: Introduction') // 'chapter-1-introduction'
 * sanitizeFilename('Привет Мир') // 'привет-мир'
 */
export function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

/**
 * Extract the base URL (protocol + host) from a full URL.
 *
 * @param url - Full URL to extract base from
 * @returns Base URL containing protocol and host
 * @throws {TypeError} If URL is invalid
 *
 * @example
 * getBaseUrl('https://example.com/path/to/page') // 'https://example.com'
 * getBaseUrl('http://localhost:3000/page') // 'http://localhost:3000'
 */
export function getBaseUrl(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}

/**
 * Generate a markdown anchor from a heading title.
 * Matches the anchor generation used by GitHub/CommonMark style processors.
 *
 * @param title - Heading title to convert to anchor
 * @returns Anchor ID suitable for markdown links
 *
 * @example
 * generateAnchor('Hello World') // 'hello-world'
 * generateAnchor('Chapter 1: Introduction') // 'chapter-1-introduction'
 * generateAnchor('Скелетные мышцы') // 'скелетные-мышцы'
 */
export function generateAnchor(title: string): string {
  return title
    .toLowerCase()
    .replace(/ /g, '-')                    // Replace spaces with hyphens
    .replace(/[^a-zа-яё0-9-]/gi, '')       // Remove non-alphanumeric except hyphens
    .replace(/^-+|-+$/g, '');              // Strip leading/trailing hyphens
}

/**
 * Deduplicate content parts by comparing text content (or image src for images).
 * Removes duplicate blocks that Tilda creates for responsive design.
 *
 * @param contentParts - Array of HTML content strings to deduplicate
 * @returns Deduplicated array with first occurrence of each unique content preserved
 *
 * @remarks
 * This function works in both browser context (page.evaluate) and Node.js (testing).
 * For images, deduplication is based on src attribute.
 * For text content, deduplication is based on extracted text.
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
