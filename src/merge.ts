/**
 * Merge chapter markdown files into a single document
 *
 * Usage: npm run merge [-- --name "Book Title"]
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { generateAnchor, setupSignalHandlers, validateBookMeta } from './utils.js';
import type { ChapterMeta, BookMeta } from './types.js';

// Re-export types for backwards compatibility
export type { ChapterMeta, BookMeta } from './types.js';

const OUTPUT_DIR = 'output';
const CHAPTERS_DIR = path.join(OUTPUT_DIR, 'chapters');
const META_FILE = path.join(OUTPUT_DIR, 'meta.json');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'book.md');

/**
 * Print usage information for the merge command.
 */
function showUsage(): void {
  console.log('Usage: npm run merge [-- --name "Book Title"]');
  console.log('');
  console.log('Merge scraped chapters into a single markdown document with TOC.');
  console.log('');
  console.log('Options:');
  console.log('  --name <title>       Book title for the document (default: "Book")');
  console.log('  --help, -h           Show this help message');
  console.log('');
  console.log('Example:');
  console.log('  npm run merge -- --name "My Book Title"');
}

/**
 * Parse command line arguments for the merge command.
 *
 * @param args - Command line arguments (defaults to process.argv)
 * @returns Parsed options with book name and help flag
 */
export function parseArgs(args: string[] = process.argv.slice(2)): { name: string; showHelp: boolean } {
  let name = 'Book';
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') {
      showHelp = true;
    } else if (args[i] === '--name' && args[i + 1]) {
      name = args[i + 1];
      i++;
    }
  }

  return { name, showHelp };
}

/**
 * Fix image paths in chapter content for the merged document.
 * Converts relative paths from chapter perspective (../images/)
 * to merged document perspective (./images/).
 *
 * @param content - Markdown content with image references
 * @returns Content with corrected image paths
 */
export function fixImagePaths(content: string): string {
  return content.replace(/\.\.\/(images\/)/g, './$1');
}

/**
 * Generate a table of contents entry for a chapter.
 * Creates a numbered markdown link with proper anchor.
 *
 * @param chapter - Chapter metadata
 * @returns Formatted TOC entry (e.g., '1. [Introduction](#introduction)')
 */
export function generateTocEntry(chapter: ChapterMeta): string {
  const anchor = generateAnchor(chapter.title);
  return `${chapter.index + 1}. [${chapter.title}](#${anchor})`;
}

/**
 * Main entry point for the merge command.
 * Reads chapter files and metadata, then creates a merged book.md with TOC.
 *
 * @throws Exits with code 1 if meta.json is missing or has no chapters
 */
export async function main(): Promise<void> {
  const { name, showHelp } = parseArgs();

  if (showHelp) {
    showUsage();
    process.exit(0);
  }

  // Check if meta.json exists
  try {
    await fs.access(META_FILE);
  } catch {
    console.error(`Error: ${META_FILE} not found. Run 'npm run scrape' first.`);
    process.exit(1);
  }

  // Read and validate metadata
  const metaContent = await fs.readFile(META_FILE, 'utf-8');
  const parsedMeta = JSON.parse(metaContent);

  const validation = validateBookMeta(parsedMeta);
  if (!validation.isValid) {
    console.error(`Error: Invalid ${META_FILE}: ${validation.error}`);
    process.exit(1);
  }

  const meta = parsedMeta as BookMeta;

  if (meta.chapters.length === 0) {
    console.error('Error: No chapters found in metadata.');
    process.exit(1);
  }

  console.log(`Merging ${meta.chapters.length} chapters...`);

  const parts: string[] = [];

  // Add a title page with metadata
  parts.push(`# ${name}\n`);
  parts.push(`Scraped from: ${meta.startUrl}`);
  parts.push(`Date: ${new Date(meta.scrapedAt).toLocaleDateString()}`);
  parts.push(`Chapters: ${meta.chapters.length}`);
  parts.push('\n---\n');

  // Add table of contents
  parts.push('## Table of Contents\n');
  for (const chapter of meta.chapters) {
    parts.push(generateTocEntry(chapter));
  }
  parts.push('\n---\n');

  // Read and concatenate each chapter
  for (const chapter of meta.chapters) {
    const chapterPath = path.join(CHAPTERS_DIR, chapter.filename);

    try {
      const content = await fs.readFile(chapterPath, 'utf-8');
      parts.push(fixImagePaths(content));
      parts.push('\n---\n'); // Page break between chapters
      console.log(`  Added: ${chapter.filename}`);
    } catch (error) {
      console.error(`  Warning: Could not read ${chapter.filename}, skipping.`);
    }
  }

  // Write merged document
  const merged = parts.join('\n');
  await fs.writeFile(OUTPUT_FILE, merged, 'utf-8');

  const stats = await fs.stat(OUTPUT_FILE);
  const sizeKb = (stats.size / 1024).toFixed(1);

  console.log(`\nMerged document saved to: ${OUTPUT_FILE} (${sizeKb} KB)`);
}

// Only run main when executed directly (not when imported for testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  setupSignalHandlers('Merge');
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}
