/**
 * Shared type definitions for the scraper
 */

/** Metadata for a single chapter */
export interface ChapterMeta {
  /** Zero-based index of the chapter */
  index: number;
  /** Chapter title extracted from the page */
  title: string;
  /** Original URL of the chapter */
  url: string;
  /** Local filename (e.g., '001-introduction.md') */
  filename: string;
}

/** Metadata for the entire book, stored in meta.json */
export interface BookMeta {
  /** ISO timestamp when scraping was performed */
  scrapedAt: string;
  /** Starting URL for the scrape */
  startUrl: string;
  /** Array of chapter metadata in order */
  chapters: ChapterMeta[];
}
