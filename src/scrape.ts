/**
 * Scrape book chapters from Tilda-based websites
 *
 * Usage: npm run scrape -- <start-url> [options]
 * Example: npm run scrape -- https://example.com/book --wait 1000 --delay 1000
 *
 * Options:
 *   --wait ms           Page render wait time (default: 1000)
 *   --delay ms          Delay between chapters (default: 1000)
 *   --skip <url>        Skip specific URL (can be used multiple times)
 *   --url-pattern <p>   Only include URLs matching glob pattern
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Page } from "puppeteer";
import sharp from "sharp";
import TurndownService from "turndown";
import { createPage, launchBrowser } from "./browser.js";
import type { BookMeta, ChapterMeta } from "./types.js";
import {
  fetchWithRetry,
  getBaseUrl,
  getMultiStringArg,
  getNullableStringArg,
  getNumberArg,
  getPositionalArg,
  globToRegex,
  hasHelpFlag,
  onInterrupt,
  sanitizeFilename,
  setupSignalHandlers,
  transformTildaImageUrl,
  validateUrl,
} from "./utils.js";

const OUTPUT_DIR = "output";
const CHAPTERS_DIR = path.join(OUTPUT_DIR, "chapters");
const IMAGES_DIR = path.join(OUTPUT_DIR, "images");

// Default timing values (in ms)
const DEFAULT_PAGE_WAIT = 1000; // Wait after page load for JS rendering
const DEFAULT_CHAPTER_DELAY = 1000; // Delay between chapters (+ random 0-500ms)

// Tilda block types to skip during content extraction
// These are navigation, menu, and non-content blocks
const TILDA_SKIP_BLOCK_TYPES = [
  "229", // Header/menu block
  "228", // Header/menu block (alternate)
  "702", // Cover/hero block
  "210", // Form block
];

// Minimum number of links to consider a page as a table of contents
// Pages with fewer links are treated as chapter pages with "next" navigation
const TOC_LINK_THRESHOLD = 20;

/**
 * Tracks image download statistics during scraping.
 * Pass this to functions to avoid global mutable state.
 */
export interface ImageStats {
  /** Next available image index (incremented after each use) */
  nextIndex: number;
  /** Count of images that failed to download or save */
  failedCount: number;
}

/**
 * Create a new ImageStats object with initial values.
 *
 * @returns Fresh ImageStats starting at index 0
 */
export function createImageStats(): ImageStats {
  return { nextIndex: 0, failedCount: 0 };
}

/** Configuration options for the scraper */
export interface ScraperOptions {
  /** Starting URL to scrape */
  startUrl: string;
  /** Wait time after page load for JS rendering (ms) */
  pageWait: number;
  /** Delay between scraping chapters (ms) */
  chapterDelay: number;
  /** URLs to skip during scraping */
  skipUrls: string[];
  /** Glob pattern to filter URLs */
  urlPattern: string | null;
  /** Whether to show help and exit */
  showHelp: boolean;
}

/**
 * Print usage information for the scrape command.
 */
function showUsage(): void {
  console.log("Usage: npm run scrape -- <start-url> [options]");
  console.log("");
  console.log("Scrape book chapters from a Tilda-based website.");
  console.log("");
  console.log("Options:");
  console.log("  --wait <ms>          Page render wait time (default: 1000)");
  console.log("  --delay <ms>         Delay between chapters (default: 1000)");
  console.log("  --skip <url>         Skip specific URL (can be used multiple times)");
  console.log("  --url-pattern <p>    Only include URLs matching glob pattern");
  console.log("  --help, -h           Show this help message");
  console.log("");
  console.log("Example:");
  console.log("  npm run scrape -- https://example.com/book --wait 2000");
}

/**
 * Parse command line arguments for the scrape command.
 *
 * @param args - Command line arguments (defaults to process.argv)
 * @returns Parsed scraper options
 */
/** Flags that take values, used for positional argument detection */
const SCRAPER_VALUE_FLAGS = ["--wait", "--delay", "--skip", "--url-pattern"];

export function parseArgs(args: string[] = process.argv.slice(2)): ScraperOptions {
  return {
    startUrl: getPositionalArg(args, SCRAPER_VALUE_FLAGS),
    pageWait: getNumberArg(args, "--wait", DEFAULT_PAGE_WAIT),
    chapterDelay: getNumberArg(args, "--delay", DEFAULT_CHAPTER_DELAY),
    skipUrls: getMultiStringArg(args, "--skip"),
    urlPattern: getNullableStringArg(args, "--url-pattern"),
    showHelp: hasHelpFlag(args),
  };
}

const markdownConverter = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

// Remove script/style elements from conversion
markdownConverter.remove(["script", "style", "noscript", "iframe"]);

/**
 * Wait for specified milliseconds.
 *
 * @param ms - Duration to wait in milliseconds
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Display a progress bar in the terminal.
 * Shows percentage, counts, and current item title.
 *
 * @param current - Current item number (1-based)
 * @param total - Total number of items
 * @param title - Title of the current item being processed
 */
export function progressBar(current: number, total: number, title: string): void {
  const barWidth = 30;
  const percent = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * barWidth);
  const empty = barWidth - filled;
  const bar = "=".repeat(filled) + " ".repeat(empty);

  // Truncate title to fit in terminal
  const maxTitleLen = 40;
  const shortTitle = title.length > maxTitleLen ? `${title.slice(0, maxTitleLen - 3)}...` : title.padEnd(maxTitleLen);

  process.stdout.write(`\r[${bar}] ${percent.toString().padStart(3)}% (${current}/${total}) ${shortTitle}`);

  if (current === total) {
    process.stdout.write("\n");
  }
}

/**
 * Download an image from a URL and save it locally.
 * Transforms Tilda placeholder URLs to actual image URLs.
 * Falls back to original URL if transformed URL fails.
 * Uses exponential backoff retry for transient failures.
 *
 * @param url - The image URL to download
 * @param index - Image index for filename generation
 * @param stats - Optional stats object to track failures
 * @returns Local filename if successful, null if failed
 */
export async function downloadImage(url: string, index: number, stats?: ImageStats): Promise<string | null> {
  // Transform placeholder URLs to actual image URLs
  const actualUrl = transformTildaImageUrl(url);

  try {
    const response = await fetchWithRetry(actualUrl);
    if (!response.ok) {
      // If optimized URL fails, try original
      if (actualUrl !== url) {
        const fallbackResponse = await fetchWithRetry(url);
        if (!fallbackResponse.ok) {
          if (stats) stats.failedCount++;
          return null;
        }
        const buffer = Buffer.from(await fallbackResponse.arrayBuffer());
        return await saveImage(buffer, index, stats);
      }
      if (stats) stats.failedCount++;
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return await saveImage(buffer, index, stats);
  } catch {
    if (stats) stats.failedCount++;
    return null;
  }
}

/**
 * Save an image buffer as JPEG with white background.
 * Handles transparency by flattening with white background.
 *
 * @param buffer - Image data buffer
 * @param index - Image index for filename generation
 * @param stats - Optional stats object to track failures
 * @returns Local filename if successful, null if failed
 */
export async function saveImage(buffer: Buffer, index: number, stats?: ImageStats): Promise<string | null> {
  try {
    const filename = `img-${index.toString().padStart(4, "0")}.jpg`;
    const filepath = path.join(IMAGES_DIR, filename);

    // Convert all images to JPEG with white background (handles transparency)
    await sharp(buffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 90 })
      .toFile(filepath);

    return filename;
  } catch {
    if (stats) stats.failedCount++;
    return null;
  }
}

async function extractChapterContent(page: Page): Promise<{ title: string; html: string; imageUrls: string[] }> {
  return await page.evaluate((skipBlockTypes) => {
    // Find the main content area - Tilda uses t-records containers
    const records = document.querySelectorAll("[data-record-type]");

    // Get page title from first h1 or og:title
    const title =
      document.querySelector("h1")?.textContent?.trim() ||
      document.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
      "Untitled";

    // Collect content from text and image blocks, excluding navigation and menu
    const contentParts: string[] = [];
    const imageUrls: string[] = [];

    records.forEach((record) => {
      const recordType = record.getAttribute("data-record-type");
      // Skip menu, cover, and form blocks
      if (skipBlockTypes.includes(recordType || "")) return;

      // Get text content blocks
      const textBlocks = record.querySelectorAll(
        ".t-text, .t-title, .t-descr, .t-text-impact, " +
          '[class*="t-text"], [class*="t-title"], ' +
          ".t668__content, .t686__text, .t688__text",
      );

      textBlocks.forEach((block) => {
        // Skip navigation buttons
        if (block.closest(".t-btnflex") || block.closest('[class*="menu"]')) return;
        const html = (block as HTMLElement).innerHTML;
        if (html.trim()) contentParts.push(html);
      });

      // Get images from this record
      const images = record.querySelectorAll("img[src]");
      images.forEach((img) => {
        const src = img.getAttribute("src");
        if (src && (src.includes("tildacdn.com") || src.includes("static.tildacdn.com"))) {
          imageUrls.push(src);
          // Add image tag to content
          const alt = img.getAttribute("alt") || "";
          contentParts.push(`<img src="${src}" alt="${alt}">`);
        }
      });
    });

    // If no structured content found, try getting all text from t-records
    if (contentParts.length === 0) {
      const allRecords = document.querySelector("#allrecords");
      if (allRecords) {
        // Clone and remove unwanted elements
        const clone = allRecords.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('[class*="menu"], .t-btnflex, script, style').forEach((el) => {
          el.remove();
        });

        // Extract images
        clone.querySelectorAll("img[src]").forEach((img) => {
          const src = img.getAttribute("src");
          if (src && (src.includes("tildacdn.com") || src.includes("static.tildacdn.com"))) {
            imageUrls.push(src);
          }
        });

        contentParts.push(clone.innerHTML);
      }
    }

    // Deduplicate content blocks (Tilda often has duplicate elements for responsive design)
    // Compare by text content since HTML structure may differ between duplicates
    const seen = new Set<string>();
    const uniqueParts = contentParts.filter((part) => {
      const trimmed = part.trim();
      if (!trimmed) return false;
      // Create a temporary element to extract content for comparison
      const temp = document.createElement("div");
      temp.innerHTML = trimmed;
      // For images, use src as the key; for text content, use the text
      const img = temp.querySelector("img");
      const textKey = img ? img.getAttribute("src") || "" : temp.textContent?.trim() || "";
      if (!textKey || seen.has(textKey)) return false;
      seen.add(textKey);
      return true;
    });

    return { title, html: uniqueParts.join("\n\n"), imageUrls };
  }, TILDA_SKIP_BLOCK_TYPES);
}

async function extractTocLinks(page: Page, baseUrl: string): Promise<string[]> {
  const baseHost = new URL(baseUrl).host;
  return await page.evaluate(
    (baseUrl, baseHost) => {
      // Social media and external domains to skip
      const SKIP_DOMAINS = ["t.me", "vk.com", "youtube.com", "instagram", "facebook", "twitter"];
      // Patterns that indicate non-content links
      const SKIP_PATTERNS = ["mailto:", "tel:", "#"];

      // Check if href should be skipped
      function shouldSkipHref(href: string): boolean {
        const hasSkipPattern = SKIP_PATTERNS.some((p) => href.includes(p));
        const hasSocialDomain = SKIP_DOMAINS.some((d) => href.includes(d));
        return hasSkipPattern || hasSocialDomain;
      }

      // Check if element is inside navigation/menu
      function isInNavigation(element: Element): boolean {
        const menuNav = element.closest('[class*="menu"]') || element.closest('[class*="nav"]');
        const tildaMenu = element.closest(".t228") || element.closest(".t229");
        return Boolean(menuNav || tildaMenu);
      }

      // Check if URL should be included as a chapter link
      function isValidChapterUrl(fullUrl: string, currentPath: string): boolean {
        try {
          const urlObj = new URL(fullUrl);
          if (urlObj.host !== baseHost) return false;
          if (urlObj.pathname === "/" || urlObj.pathname === "") return false;
          return urlObj.pathname !== currentPath;
        } catch {
          return false;
        }
      }

      // Try to resolve href to full URL
      function resolveHref(href: string): string | null {
        try {
          return new URL(href, baseUrl).href;
        } catch {
          return null;
        }
      }

      const links: string[] = [];
      const seen = new Set<string>();
      const currentPath = window.location.pathname;

      for (const a of document.querySelectorAll("a[href]")) {
        const href = a.getAttribute("href");
        if (!href || shouldSkipHref(href)) continue;

        const fullUrl = resolveHref(href);
        if (!fullUrl || !isValidChapterUrl(fullUrl, currentPath)) continue;
        if (isInNavigation(a)) continue;

        if (!seen.has(fullUrl)) {
          seen.add(fullUrl);
          links.push(fullUrl);
        }
      }

      return links;
    },
    baseUrl,
    baseHost,
  );
}

async function findNextChapterLink(page: Page, baseUrl: string): Promise<string | null> {
  return await page.evaluate((baseUrl) => {
    // Look for "next" navigation button
    const nextButtons = document.querySelectorAll("a[href]");
    for (const btn of nextButtons) {
      const text = btn.textContent?.toLowerCase() || "";
      // Common patterns: "next", "следующая" (Russian), "далее" (forward), "→"
      if (text.includes("next") || text.includes("следующ") || text.includes("далее") || text.includes("→")) {
        const href = btn.getAttribute("href");
        if (href && !href.startsWith("#")) {
          try {
            return new URL(href, baseUrl).href;
          } catch {
            // Invalid URL, continue searching
          }
        }
      }
    }
    return null;
  }, baseUrl);
}

async function scrapeChapter(
  page: Page,
  url: string,
  index: number,
  total: number | undefined,
  pageWait: number,
  stats: ImageStats,
): Promise<ChapterMeta> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

  // Wait for JS to render content
  await delay(pageWait);

  const { title, html, imageUrls } = await extractChapterContent(page);

  // Download images in parallel
  const uniqueUrls = [...new Set(imageUrls)];
  const downloadPromises = uniqueUrls.map(async (imgUrl) => {
    const imgIndex = stats.nextIndex++;
    const localFile = await downloadImage(imgUrl, imgIndex, stats);
    return { imgUrl, localFile };
  });

  const results = await Promise.all(downloadPromises);
  // Map remote image URLs to local file paths
  const imageUrlMap = new Map<string, string>();
  for (const { imgUrl, localFile } of results) {
    if (localFile) {
      imageUrlMap.set(imgUrl, `../images/${localFile}`);
    }
  }

  // Convert to markdown
  let markdown = markdownConverter.turndown(html);

  // Replace remote image URLs with local paths
  // Using split/join as a global replace (avoids regex escaping issues with URLs)
  for (const [remoteUrl, localPath] of imageUrlMap) {
    markdown = markdown.split(remoteUrl).join(localPath);
  }

  const filename = `${String(index + 1).padStart(3, "0")}-${sanitizeFilename(title)}.md`;
  const filepath = path.join(CHAPTERS_DIR, filename);

  // Add title as H1 if not already present
  const content = markdown.startsWith("#") ? markdown : `# ${title}\n\n${markdown}`;
  await fs.writeFile(filepath, content, "utf-8");

  // Show progress bar if total is known, otherwise simple log
  if (total) {
    progressBar(index + 1, total, title);
  } else {
    console.log(`  [${index + 1}] ${title}`);
  }

  return { index, title, url, filename };
}

/** Result of a chapter scrape attempt */
interface ChapterResult {
  success: boolean;
  chapter?: ChapterMeta;
  error?: { index: number; url: string; message: string };
}

/**
 * Filter chapter links based on skip URLs and URL pattern.
 */
function filterChapterLinks(links: string[], skipUrls: string[], urlPattern: string | null): string[] {
  let filtered = links;

  if (skipUrls.length > 0) {
    filtered = filtered.filter((link) => !skipUrls.some((skip) => link.includes(skip)));
  }

  if (urlPattern) {
    const regex = globToRegex(urlPattern);
    filtered = filtered.filter((link) => regex.test(link));
  }

  return filtered;
}

/**
 * Scrape chapters in TOC mode (from a list of links).
 */
async function scrapeTocChapters(
  page: Page,
  links: string[],
  pageWait: number,
  chapterDelay: number,
  stats: ImageStats,
): Promise<ChapterResult[]> {
  const results: ChapterResult[] = [];

  for (let i = 0; i < links.length; i++) {
    try {
      const chapter = await scrapeChapter(page, links[i], i, links.length, pageWait, stats);
      results.push({ success: true, chapter });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ success: false, error: { index: i, url: links[i], message } });
      progressBar(i + 1, links.length, `FAILED: ${links[i].slice(-30)}`);
    }

    if (i < links.length - 1) {
      await delay(chapterDelay + Math.random() * 500);
    }
  }

  return results;
}

/**
 * Scrape chapters in navigation mode (following next links).
 */
async function scrapeNavigationChapters(
  page: Page,
  startUrl: string,
  baseUrl: string,
  pageWait: number,
  chapterDelay: number,
  stats: ImageStats,
): Promise<ChapterResult[]> {
  const results: ChapterResult[] = [];
  const visitedUrls = new Set<string>();
  let currentUrl: string | null = startUrl;
  let index = 0;

  while (currentUrl) {
    try {
      const chapter = await scrapeChapter(page, currentUrl, index, undefined, pageWait, stats);
      results.push({ success: true, chapter });
      visitedUrls.add(currentUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ success: false, error: { index, url: currentUrl, message } });
      console.log(`  [${index + 1}] FAILED: ${currentUrl.slice(-40)}`);
    }

    const nextUrl = await findNextChapterLink(page, baseUrl);
    if (nextUrl && !visitedUrls.has(nextUrl)) {
      currentUrl = nextUrl;
      index++;
      await delay(chapterDelay + Math.random() * 500);
    } else {
      currentUrl = null;
    }
  }

  return results;
}

/**
 * Print scrape summary and return exit code.
 */
function printScrapeSummary(chapters: ChapterMeta[], failedCount: number, imageFailedCount: number): number {
  console.log(`\nDone! Scraped ${chapters.length} chapters.`);

  if (imageFailedCount > 0) {
    console.log(`Warning: ${imageFailedCount} image(s) failed to download.`);
  }

  return failedCount > 0 ? 1 : 0;
}

/**
 * Main entry point for the scraper.
 * Launches browser, navigates to start URL, and scrapes all chapters.
 * Supports both TOC mode (many links) and navigation mode (follow next links).
 *
 * @throws Exits with code 1 if no URL provided or scraping fails
 */
export async function main(): Promise<void> {
  const { startUrl, pageWait, chapterDelay, skipUrls, urlPattern, showHelp } = parseArgs();

  if (showHelp) {
    showUsage();
    process.exit(0);
  }

  if (!startUrl) {
    showUsage();
    process.exit(1);
  }

  // Validate URL format before attempting to scrape
  const urlValidation = validateUrl(startUrl);
  if (!urlValidation.isValid) {
    console.error(`Error: ${urlValidation.error}`);
    process.exit(1);
  }

  const baseUrl = getBaseUrl(startUrl);

  // Track image statistics for this run
  const imageStats = createImageStats();

  // Create output directories
  await fs.mkdir(CHAPTERS_DIR, { recursive: true });
  await fs.mkdir(IMAGES_DIR, { recursive: true });

  console.log("Launching browser...");
  const browser = await launchBrowser();

  // Register browser cleanup for graceful shutdown on Ctrl+C
  onInterrupt(async () => {
    await browser.close();
  });

  const page = await createPage(browser);

  const meta: BookMeta = {
    scrapedAt: new Date().toISOString(),
    startUrl,
    chapters: [],
  };

  try {
    console.log(`Navigating to start URL: ${startUrl}`);
    await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(pageWait);

    // Check if this is a TOC page (has multiple chapter links) or a chapter page
    const rawLinks = await extractTocLinks(page, baseUrl);
    const links = filterChapterLinks(rawLinks, skipUrls, urlPattern);

    if (links.length !== rawLinks.length) {
      console.log(`Filtered ${rawLinks.length - links.length} URLs (${rawLinks.length} → ${links.length})`);
    }

    // Scrape chapters using appropriate mode
    let results: ChapterResult[];
    if (links.length > TOC_LINK_THRESHOLD) {
      console.log(`Found ${links.length} chapters. Scraping...\n`);
      results = await scrapeTocChapters(page, links, pageWait, chapterDelay, imageStats);
    } else {
      console.log("Following navigation links...\n");
      results = await scrapeNavigationChapters(page, startUrl, baseUrl, pageWait, chapterDelay, imageStats);
    }

    // Collect successful chapters and failures
    for (const result of results) {
      if (result.success && result.chapter) {
        meta.chapters.push(result.chapter);
      }
    }
    const failedChapters = results
      .filter(
        (r): r is ChapterResult & { error: NonNullable<ChapterResult["error"]> } => !r.success && r.error !== undefined,
      )
      .map((r) => r.error);

    // Save metadata
    const metaPath = path.join(OUTPUT_DIR, "meta.json");
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");
    console.log(`\nSaved metadata to ${metaPath}`);

    const exitCode = printScrapeSummary(meta.chapters, failedChapters.length, imageStats.failedCount);

    if (failedChapters.length > 0) {
      console.log(`\nFailed chapters (${failedChapters.length}):`);
      for (const { index, url } of failedChapters) {
        console.log(`  [${index + 1}] ${url}`);
      }
    }

    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Only run main when executed directly (not when imported for testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  setupSignalHandlers("Scraping");
  main();
}
