/**
 * Merge chapter markdown files into a single document
 *
 * Usage: npm run merge [-- --name "Book Title"]
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { generateAnchor } from './utils.js';

const OUTPUT_DIR = 'output';
const CHAPTERS_DIR = path.join(OUTPUT_DIR, 'chapters');
const META_FILE = path.join(OUTPUT_DIR, 'meta.json');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'book.md');

export interface ChapterMeta {
  index: number;
  title: string;
  url: string;
  filename: string;
}

export interface BookMeta {
  scrapedAt: string;
  startUrl: string;
  chapters: ChapterMeta[];
}

/**
 * Parse command line arguments from an array
 * Exported for testing
 */
export function parseArgs(args: string[] = process.argv.slice(2)): { name: string } {
  let name = 'Book';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      name = args[i + 1];
      i++;
    }
  }

  return { name };
}

/**
 * Fix image paths in chapter content
 * Chapters use ../images/, but book.md is in output/ so use ./images/
 * Exported for testing
 */
export function fixImagePaths(content: string): string {
  return content.replace(/\.\.\/(images\/)/g, './$1');
}

/**
 * Generate a table of contents entry for a chapter
 * Exported for testing
 */
export function generateTocEntry(chapter: ChapterMeta): string {
  const anchor = generateAnchor(chapter.title);
  return `${chapter.index + 1}. [${chapter.title}](#${anchor})`;
}

async function main() {
  const { name } = parseArgs();

  // Check if meta.json exists
  try {
    await fs.access(META_FILE);
  } catch {
    console.error(`Error: ${META_FILE} not found. Run 'npm run scrape' first.`);
    process.exit(1);
  }

  // Read metadata
  const metaContent = await fs.readFile(META_FILE, 'utf-8');
  const meta: BookMeta = JSON.parse(metaContent);

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
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}
