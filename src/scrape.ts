/**
 * Scrape book chapters from sportlabmipt.ru
 *
 * Usage: npm run scrape -- <start-url>
 * Example: npm run scrape -- https://sportlabmipt.ru/sportsphysyologybook
 */

import puppeteer from 'puppeteer';
import TurndownService from 'turndown';
import * as fs from 'fs/promises';
import * as path from 'path';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

// TODO: Implement scraping logic
// 1. Launch browser with realistic user-agent
// 2. Navigate to TOC page
// 3. Extract chapter links
// 4. For each chapter:
//    - Navigate to page, wait for JS render
//    - Extract content from t-records containers
//    - Convert to markdown via turndown
//    - Save to output/chapters/XX-chapter-name.md
// 5. Save metadata (chapter order, titles) to output/meta.json

console.log('Scraper not yet implemented');
