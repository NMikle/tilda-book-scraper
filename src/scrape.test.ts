import { describe, it, expect } from 'vitest';
import { parseArgs } from './scrape.js';

describe('parseArgs', () => {
  it('returns defaults when no args provided', () => {
    const result = parseArgs([]);
    expect(result).toEqual({
      startUrl: '',
      pageWait: 1000,
      chapterDelay: 1000,
      skipUrls: [],
      urlPattern: null,
    });
  });

  it('parses start URL from positional argument', () => {
    const result = parseArgs(['https://example.com/book']);
    expect(result.startUrl).toBe('https://example.com/book');
  });

  it('parses --wait flag', () => {
    const result = parseArgs(['https://example.com', '--wait', '2000']);
    expect(result.pageWait).toBe(2000);
  });

  it('parses --delay flag', () => {
    const result = parseArgs(['https://example.com', '--delay', '1500']);
    expect(result.chapterDelay).toBe(1500);
  });

  it('parses single --skip flag', () => {
    const result = parseArgs(['https://example.com', '--skip', 'https://example.com/skip']);
    expect(result.skipUrls).toEqual(['https://example.com/skip']);
  });

  it('parses multiple --skip flags', () => {
    const result = parseArgs([
      'https://example.com',
      '--skip', 'https://example.com/skip1',
      '--skip', 'https://example.com/skip2',
    ]);
    expect(result.skipUrls).toEqual([
      'https://example.com/skip1',
      'https://example.com/skip2',
    ]);
  });

  it('parses --url-pattern flag', () => {
    const result = parseArgs(['https://example.com', '--url-pattern', '*/page*.html']);
    expect(result.urlPattern).toBe('*/page*.html');
  });

  it('parses all flags together', () => {
    const result = parseArgs([
      'https://example.com/book',
      '--wait', '500',
      '--delay', '750',
      '--skip', 'https://example.com/exclude',
      '--url-pattern', '**/*.html',
    ]);
    expect(result).toEqual({
      startUrl: 'https://example.com/book',
      pageWait: 500,
      chapterDelay: 750,
      skipUrls: ['https://example.com/exclude'],
      urlPattern: '**/*.html',
    });
  });

  it('ignores flags without values', () => {
    const result = parseArgs(['https://example.com', '--wait']);
    expect(result.pageWait).toBe(1000); // default
  });

  it('handles URL before flags', () => {
    const result = parseArgs(['https://example.com', '--wait', '2000']);
    expect(result.startUrl).toBe('https://example.com');
    expect(result.pageWait).toBe(2000);
  });

  it('handles URL after flags', () => {
    const result = parseArgs(['--wait', '2000', 'https://example.com']);
    expect(result.startUrl).toBe('https://example.com');
    expect(result.pageWait).toBe(2000);
  });
});
