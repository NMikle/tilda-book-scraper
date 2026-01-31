/**
 * Browser management utilities for Puppeteer
 *
 * Extracted from scrape.ts to reduce file size and improve testability.
 */

import puppeteer, { type Browser, type Page } from "puppeteer";

/**
 * Realistic Chrome user agent to avoid bot detection.
 * Matches a recent stable Chrome version on macOS.
 */
export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Default viewport dimensions for the browser page */
export const DEFAULT_VIEWPORT = { width: 1280, height: 800 };

/**
 * Launch a new headless browser instance with security sandbox disabled.
 * The sandbox is disabled for compatibility in Docker/CI environments.
 *
 * @returns Promise resolving to a Browser instance
 */
export function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

/**
 * Create a new page with realistic browser settings.
 * Sets user agent and viewport to mimic a real Chrome browser.
 *
 * @param browser - Browser instance to create the page in
 * @returns Promise resolving to a configured Page instance
 */
export async function createPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage();
  await page.setUserAgent(DEFAULT_USER_AGENT);
  await page.setViewport(DEFAULT_VIEWPORT);
  return page;
}
