/**
 * Utility functions for the scraper
 * Extracted for testability
 */

/** Callback for cleanup actions when process is interrupted */
type CleanupCallback = () => void | Promise<void>;

/** Registered cleanup callbacks for SIGINT handling */
const cleanupCallbacks: CleanupCallback[] = [];

/** Flag to prevent multiple SIGINT handlers from running */
let isExiting = false;

/**
 * Register a cleanup callback to be called when the process receives SIGINT.
 * Multiple callbacks can be registered and will be called in order.
 *
 * @param callback - Async or sync function to call during cleanup
 */
export function onInterrupt(callback: CleanupCallback): void {
  cleanupCallbacks.push(callback);
}

/**
 * Setup graceful shutdown handlers for SIGINT (Ctrl+C) and SIGTERM.
 * Displays a clean message instead of a stack trace when interrupted.
 * Should be called once at the start of the main entry point.
 *
 * @param commandName - Name of the command for the exit message (e.g., "Scraping", "PDF generation")
 */
export function setupSignalHandlers(commandName: string): void {
  const handler = async (signal: string) => {
    if (isExiting) return;
    isExiting = true;

    console.log(`\n${commandName} interrupted.`);

    // Run cleanup callbacks
    for (const callback of cleanupCallbacks) {
      try {
        await callback();
      } catch {
        // Ignore cleanup errors during shutdown
      }
    }

    // Exit with appropriate code (128 + signal number)
    // SIGINT = 2, SIGTERM = 15
    const exitCode = signal === 'SIGINT' ? 130 : 143;
    process.exit(exitCode);
  };

  process.on('SIGINT', () => handler('SIGINT'));
  process.on('SIGTERM', () => handler('SIGTERM'));
}

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
    // Keep Latin (a-z), Cyrillic (а-яё), and digits; replace all else with dashes
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
    // Keep Latin (a-z), Cyrillic (а-яё), digits, and hyphens
    .replace(/[^a-zа-яё0-9-]/gi, '')
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

// ============================================================================
// Argument Parsing Helpers
// ============================================================================

/**
 * Check if help flag is present in arguments.
 *
 * @param args - Command line arguments array
 * @returns True if --help or -h is present
 */
export function hasHelpFlag(args: string[]): boolean {
  return args.includes('--help') || args.includes('-h');
}

/**
 * Get a string argument value from command line arguments.
 * If the flag appears multiple times, returns the last value.
 *
 * @param args - Command line arguments array
 * @param flag - Flag to look for (e.g., '--name')
 * @param defaultValue - Default value if flag not found
 * @returns The argument value or default
 */
export function getStringArg(args: string[], flag: string, defaultValue: string): string {
  let result = defaultValue;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag && args[i + 1] && !args[i + 1].startsWith('--')) {
      result = args[i + 1];
    }
  }
  return result;
}

/**
 * Get a nullable string argument value from command line arguments.
 *
 * @param args - Command line arguments array
 * @param flag - Flag to look for (e.g., '--url-pattern')
 * @returns The argument value or null if not found
 */
export function getNullableStringArg(args: string[], flag: string): string | null {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag && args[i + 1] && !args[i + 1].startsWith('--')) {
      return args[i + 1];
    }
  }
  return null;
}

/**
 * Get a number argument value from command line arguments.
 *
 * @param args - Command line arguments array
 * @param flag - Flag to look for (e.g., '--wait')
 * @param defaultValue - Default value if flag not found
 * @returns The parsed number or default
 */
export function getNumberArg(args: string[], flag: string, defaultValue: number): number {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag && args[i + 1]) {
      const parsed = parseInt(args[i + 1], 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return defaultValue;
}

/**
 * Get all values for a repeatable string argument.
 *
 * @param args - Command line arguments array
 * @param flag - Flag to look for (e.g., '--skip')
 * @returns Array of all values for the flag
 */
export function getMultiStringArg(args: string[], flag: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag && args[i + 1] && !args[i + 1].startsWith('--')) {
      values.push(args[i + 1]);
    }
  }
  return values;
}

/**
 * Get the first positional (non-flag) argument.
 * Skips values that follow flags (e.g., in '--wait 1000', skips '1000').
 *
 * @param args - Command line arguments array
 * @param knownFlags - Flags that take values (to skip their values)
 * @returns The first non-flag argument or empty string
 */
export function getPositionalArg(args: string[], knownFlags: string[] = []): string {
  let skipNext = false;
  for (const arg of args) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (knownFlags.includes(arg)) {
      skipNext = true;
      continue;
    }
    if (!arg.startsWith('--') && !arg.startsWith('-')) {
      return arg;
    }
  }
  return '';
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate that a string is a valid HTTP/HTTPS URL.
 *
 * @param url - URL string to validate
 * @returns Object with isValid boolean and error message if invalid
 *
 * @example
 * validateUrl('https://example.com') // { isValid: true }
 * validateUrl('not-a-url') // { isValid: false, error: 'Invalid URL format' }
 * validateUrl('ftp://example.com') // { isValid: false, error: 'URL must use http or https protocol' }
 */
export function validateUrl(url: string): { isValid: true } | { isValid: false; error: string } {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'URL is required' };
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { isValid: false, error: 'URL must use http or https protocol' };
    }
    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

/** Result of meta.json validation */
export interface MetaValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate the structure of meta.json content.
 * Checks that all required fields exist and have correct types.
 *
 * @param data - Parsed JSON data to validate
 * @returns Object with isValid boolean and error message if invalid
 *
 * @example
 * validateBookMeta({ scrapedAt: '...', startUrl: '...', chapters: [] }) // { isValid: true }
 * validateBookMeta({ startUrl: '...' }) // { isValid: false, error: 'Missing required field: scrapedAt' }
 */
export function validateBookMeta(data: unknown): MetaValidationResult {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'meta.json must be an object' };
  }

  const meta = data as Record<string, unknown>;

  // Check required top-level fields
  if (typeof meta.scrapedAt !== 'string') {
    return { isValid: false, error: 'Missing or invalid field: scrapedAt (expected string)' };
  }

  if (typeof meta.startUrl !== 'string') {
    return { isValid: false, error: 'Missing or invalid field: startUrl (expected string)' };
  }

  if (!Array.isArray(meta.chapters)) {
    return { isValid: false, error: 'Missing or invalid field: chapters (expected array)' };
  }

  // Validate each chapter
  for (let i = 0; i < meta.chapters.length; i++) {
    const chapter = meta.chapters[i] as Record<string, unknown>;
    if (!chapter || typeof chapter !== 'object') {
      return { isValid: false, error: `chapters[${i}] must be an object` };
    }

    if (typeof chapter.index !== 'number') {
      return { isValid: false, error: `chapters[${i}].index must be a number` };
    }

    if (typeof chapter.title !== 'string') {
      return { isValid: false, error: `chapters[${i}].title must be a string` };
    }

    if (typeof chapter.url !== 'string') {
      return { isValid: false, error: `chapters[${i}].url must be a string` };
    }

    if (typeof chapter.filename !== 'string') {
      return { isValid: false, error: `chapters[${i}].filename must be a string` };
    }
  }

  return { isValid: true };
}
