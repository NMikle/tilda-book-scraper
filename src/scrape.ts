/**
 * Scrape book chapters from Tilda-based websites
 *
 * Usage: npm run scrape -- <start-url> [--wait ms] [--delay ms]
 * Example: npm run scrape -- https://example.com/book --wait 1000 --delay 1000
 */

import puppeteer, { type Page } from 'puppeteer';
import TurndownService from 'turndown';
import sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';

const OUTPUT_DIR = 'output';
const CHAPTERS_DIR = path.join(OUTPUT_DIR, 'chapters');
const IMAGES_DIR = path.join(OUTPUT_DIR, 'images');

// Default timing values (in ms)
const DEFAULT_PAGE_WAIT = 1000;    // Wait after page load for JS rendering
const DEFAULT_CHAPTER_DELAY = 1000; // Delay between chapters (+ random 0-500ms)

let imageCounter = 0;

interface ScraperOptions {
  startUrl: string;
  pageWait: number;
  chapterDelay: number;
}

function parseArgs(): ScraperOptions {
  const args = process.argv.slice(2);
  let startUrl = '';
  let pageWait = DEFAULT_PAGE_WAIT;
  let chapterDelay = DEFAULT_CHAPTER_DELAY;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--wait' && args[i + 1]) {
      pageWait = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--delay' && args[i + 1]) {
      chapterDelay = parseInt(args[i + 1], 10);
      i++;
    } else if (!args[i].startsWith('--')) {
      startUrl = args[i];
    }
  }

  return { startUrl, pageWait, chapterDelay };
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

// Remove script/style elements from conversion
turndown.remove(['script', 'style', 'noscript', 'iframe']);

interface ChapterMeta {
  index: number;
  title: string;
  url: string;
  filename: string;
}

interface BookMeta {
  scrapedAt: string;
  startUrl: string;
  chapters: ChapterMeta[];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function progressBar(current: number, total: number, title: string): void {
  const barWidth = 30;
  const percent = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * barWidth);
  const empty = barWidth - filled;
  const bar = '='.repeat(filled) + ' '.repeat(empty);

  // Truncate title to fit in terminal
  const maxTitleLen = 40;
  const shortTitle = title.length > maxTitleLen
    ? title.slice(0, maxTitleLen - 3) + '...'
    : title.padEnd(maxTitleLen);

  process.stdout.write(`\r[${bar}] ${percent.toString().padStart(3)}% (${current}/${total}) ${shortTitle}`);

  if (current === total) {
    process.stdout.write('\n');
  }
}

function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

function getBaseUrl(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}

function transformTildaImageUrl(url: string): string {
  // Transform placeholder URLs to actual image URLs
  // thb.tildacdn.com/tildXXXX/-/empty/image.png -> static.tildacdn.com/tildXXXX/image.png
  if (url.includes('tildacdn.com') && url.includes('/-/empty/')) {
    // Extract the tild hash and filename
    const match = url.match(/\/(tild[^/]+)\/-\/empty\/(.+)$/);
    if (match) {
      return `https://static.tildacdn.com/${match[1]}/${match[2]}`;
    }
  }
  return url;
}

async function downloadImage(url: string, index: number): Promise<string | null> {
  // Transform placeholder URLs to actual image URLs
  const actualUrl = transformTildaImageUrl(url);

  try {
    const response = await fetch(actualUrl);
    if (!response.ok) {
      // If optimized URL fails, try original
      if (actualUrl !== url) {
        const fallbackResponse = await fetch(url);
        if (!fallbackResponse.ok) return null;
        const buffer = Buffer.from(await fallbackResponse.arrayBuffer());
        return await saveImage(buffer, index);
      }
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return await saveImage(buffer, index);
  } catch {
    return null;
  }
}

async function saveImage(buffer: Buffer, index: number): Promise<string | null> {
  try {
    const filename = `img-${index.toString().padStart(4, '0')}.jpg`;
    const filepath = path.join(IMAGES_DIR, filename);

    // Convert all images to JPEG with white background (handles transparency)
    await sharp(buffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 90 })
      .toFile(filepath);

    return filename;
  } catch {
    return null;
  }
}

async function extractChapterContent(page: Page): Promise<{ title: string; html: string; imageUrls: string[] }> {
  return await page.evaluate(() => {
    // Find the main content area - Tilda uses t-records containers
    const records = document.querySelectorAll('[data-record-type]');

    // Get page title from first h1 or og:title
    let title = document.querySelector('h1')?.textContent?.trim()
      || document.querySelector('meta[property="og:title"]')?.getAttribute('content')
      || 'Untitled';

    // Collect content from text and image blocks, excluding navigation and menu
    const contentParts: string[] = [];
    const imageUrls: string[] = [];

    records.forEach((record) => {
      const recordType = record.getAttribute('data-record-type');
      // Skip menu, cover, and form blocks
      if (['229', '228', '702', '210'].includes(recordType || '')) return;

      // Get text content blocks
      const textBlocks = record.querySelectorAll(
        '.t-text, .t-title, .t-descr, .t-text-impact, ' +
        '[class*="t-text"], [class*="t-title"], ' +
        '.t668__content, .t686__text, .t688__text'
      );

      textBlocks.forEach((block) => {
        // Skip navigation buttons
        if (block.closest('.t-btnflex') || block.closest('[class*="menu"]')) return;
        const html = (block as HTMLElement).innerHTML;
        if (html.trim()) contentParts.push(html);
      });

      // Get images from this record
      const images = record.querySelectorAll('img[src]');
      images.forEach((img) => {
        const src = img.getAttribute('src');
        if (src && (src.includes('tildacdn.com') || src.includes('static.tildacdn.com'))) {
          imageUrls.push(src);
          // Add image tag to content
          const alt = img.getAttribute('alt') || '';
          contentParts.push(`<img src="${src}" alt="${alt}">`);
        }
      });
    });

    // If no structured content found, try getting all text from t-records
    if (contentParts.length === 0) {
      const allRecords = document.querySelector('#allrecords');
      if (allRecords) {
        // Clone and remove unwanted elements
        const clone = allRecords.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('[class*="menu"], .t-btnflex, script, style').forEach(el => el.remove());

        // Extract images
        clone.querySelectorAll('img[src]').forEach((img) => {
          const src = img.getAttribute('src');
          if (src && (src.includes('tildacdn.com') || src.includes('static.tildacdn.com'))) {
            imageUrls.push(src);
          }
        });

        contentParts.push(clone.innerHTML);
      }
    }

    // Deduplicate content blocks (Tilda often has duplicate elements for responsive design)
    // Compare by text content since HTML structure may differ between duplicates
    const seen = new Set<string>();
    const uniqueParts = contentParts.filter(part => {
      const trimmed = part.trim();
      if (!trimmed) return false;
      // Create a temporary element to extract text content for comparison
      const temp = document.createElement('div');
      temp.innerHTML = trimmed;
      const textKey = temp.textContent?.trim() || '';
      if (!textKey || seen.has(textKey)) return false;
      seen.add(textKey);
      return true;
    });

    return { title, html: uniqueParts.join('\n\n'), imageUrls };
  });
}

async function extractTocLinks(page: Page, baseUrl: string): Promise<string[]> {
  const baseHost = new URL(baseUrl).host;
  return await page.evaluate((baseUrl, baseHost) => {
    const links: string[] = [];
    const seen = new Set<string>();
    const currentPath = window.location.pathname;

    // Find all links that look like chapter links (within content areas, not menus)
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href) return;

      // Skip anchors on the same page
      if (href.startsWith('#')) return;
      // Skip URLs with hash fragments (like /#rec123)
      if (href.includes('#')) return;
      // Skip external links
      if (href.includes('mailto:') || href.includes('tel:')) return;
      if (href.includes('t.me') || href.includes('vk.com') || href.includes('youtube.com')) return;
      if (href.includes('instagram') || href.includes('facebook') || href.includes('twitter')) return;

      // Resolve relative URLs
      let fullUrl = href;
      if (!href.startsWith('http')) {
        fullUrl = href.startsWith('/') ? baseUrl + href : baseUrl + '/' + href;
      }

      // Only include links to the same host
      try {
        if (new URL(fullUrl).host !== baseHost) return;
      } catch {
        return;
      }

      // Extract path from full URL
      const urlPath = new URL(fullUrl).pathname;

      // Skip homepage
      if (urlPath === '/' || urlPath === '') return;

      // Skip links in menu/navigation elements
      if (a.closest('[class*="menu"]') || a.closest('[class*="nav"]')) return;
      if (a.closest('.t228') || a.closest('.t229')) return; // Tilda menu blocks

      // Skip if it's a link back to current page
      if (urlPath === currentPath) return;

      if (!seen.has(fullUrl)) {
        seen.add(fullUrl);
        links.push(fullUrl);
      }
    });

    return links;
  }, baseUrl, baseHost);
}

async function findNextChapterLink(page: Page, baseUrl: string): Promise<string | null> {
  return await page.evaluate((baseUrl) => {
    // Look for "next" navigation button
    const nextButtons = document.querySelectorAll('a[href]');
    for (const btn of nextButtons) {
      const text = btn.textContent?.toLowerCase() || '';
      // Common patterns: "next", "следующая" (Russian), "далее" (forward), "→"
      if (text.includes('next') || text.includes('следующ') || text.includes('далее') || text.includes('→')) {
        const href = btn.getAttribute('href');
        if (href && !href.startsWith('#')) {
          if (href.startsWith('http')) return href;
          if (href.startsWith('/')) return baseUrl + href;
          return baseUrl + '/' + href;
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
  pageWait: number
): Promise<ChapterMeta> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for JS to render content
  await delay(pageWait);

  const { title, html, imageUrls } = await extractChapterContent(page);

  // Download images in parallel
  const uniqueUrls = [...new Set(imageUrls)];
  const downloadPromises = uniqueUrls.map(async (imgUrl) => {
    const imgIndex = imageCounter++;
    const localFile = await downloadImage(imgUrl, imgIndex);
    return { imgUrl, localFile };
  });

  const results = await Promise.all(downloadPromises);
  const urlMap = new Map<string, string>();
  for (const { imgUrl, localFile } of results) {
    if (localFile) {
      urlMap.set(imgUrl, `../images/${localFile}`);
    }
  }

  // Convert to markdown
  let markdown = turndown.turndown(html);

  // Replace remote image URLs with local paths
  for (const [remoteUrl, localPath] of urlMap) {
    markdown = markdown.split(remoteUrl).join(localPath);
  }

  const filename = `${String(index + 1).padStart(3, '0')}-${sanitizeFilename(title)}.md`;
  const filepath = path.join(CHAPTERS_DIR, filename);

  // Add title as H1 if not already present
  const content = markdown.startsWith('#') ? markdown : `# ${title}\n\n${markdown}`;
  await fs.writeFile(filepath, content, 'utf-8');

  // Show progress bar if total is known, otherwise simple log
  if (total) {
    progressBar(index + 1, total, title);
  } else {
    console.log(`  [${index + 1}] ${title}`);
  }

  return { index, title, url, filename };
}

async function main() {
  const { startUrl, pageWait, chapterDelay } = parseArgs();

  if (!startUrl) {
    console.error('Usage: npm run scrape -- <start-url> [--wait ms] [--delay ms]');
    console.error('Example: npm run scrape -- https://example.com/book');
    console.error('Options:');
    console.error('  --wait ms    Page render wait time (default: 1000)');
    console.error('  --delay ms   Delay between chapters (default: 1000)');
    process.exit(1);
  }

  const baseUrl = getBaseUrl(startUrl);

  // Create output directories
  await fs.mkdir(CHAPTERS_DIR, { recursive: true });
  await fs.mkdir(IMAGES_DIR, { recursive: true });

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Set realistic user agent
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  // Set viewport
  await page.setViewport({ width: 1280, height: 800 });

  const meta: BookMeta = {
    scrapedAt: new Date().toISOString(),
    startUrl,
    chapters: [],
  };

  try {
    console.log(`Navigating to start URL: ${startUrl}`);
    await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(pageWait);

    // Check if this is a TOC page (has multiple chapter links) or a chapter page
    const links = await extractTocLinks(page, baseUrl);

    if (links.length > 20) {
      // This looks like a TOC page - scrape all linked chapters
      console.log(`Found ${links.length} chapters. Scraping...\n`);

      for (let i = 0; i < links.length; i++) {
        const chapterMeta = await scrapeChapter(page, links[i], i, links.length, pageWait);
        meta.chapters.push(chapterMeta);

        // Rate limiting - wait between chapters
        if (i < links.length - 1) {
          await delay(chapterDelay + Math.random() * 500);
        }
      }
    } else {
      // This is a chapter page - follow "next" links
      console.log('Following navigation links...\n');

      let currentUrl: string | null = startUrl;
      let index = 0;

      while (currentUrl) {
        const chapterMeta = await scrapeChapter(page, currentUrl, index, undefined, pageWait);
        meta.chapters.push(chapterMeta);

        // Find next chapter link
        const nextUrl = await findNextChapterLink(page, baseUrl);

        if (nextUrl && !meta.chapters.some(c => c.url === nextUrl)) {
          currentUrl = nextUrl;
          index++;
          await delay(chapterDelay + Math.random() * 500);
        } else {
          currentUrl = null;
        }
      }
    }

    // Save metadata
    const metaPath = path.join(OUTPUT_DIR, 'meta.json');
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    console.log(`\nSaved metadata to ${metaPath}`);

    console.log(`\nDone! Scraped ${meta.chapters.length} chapters.`);
  } catch (error) {
    console.error('Error during scraping:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
