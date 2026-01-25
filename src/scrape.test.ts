import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseArgs, delay, progressBar } from './scrape.js';

// Mock all external dependencies
vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn(),
  },
}));

vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    flatten: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toFile: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Import mocked modules
import puppeteer from 'puppeteer';
import * as fs from 'fs/promises';

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

describe('delay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves after specified time', async () => {
    const promise = delay(1000);

    // Should not resolve immediately
    let resolved = false;
    promise.then(() => { resolved = true; });

    expect(resolved).toBe(false);

    // Advance time
    await vi.advanceTimersByTimeAsync(1000);

    await promise;
    expect(resolved).toBe(true);
  });

  it('works with zero delay', async () => {
    const promise = delay(0);
    await vi.advanceTimersByTimeAsync(0);
    await promise;
  });
});

describe('progressBar', () => {
  let mockStdoutWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockStdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    mockStdoutWrite.mockRestore();
  });

  it('writes progress bar to stdout', () => {
    progressBar(5, 10, 'Test Title');

    expect(mockStdoutWrite).toHaveBeenCalled();
    const output = mockStdoutWrite.mock.calls[0][0] as string;
    expect(output).toContain('50%');
    expect(output).toContain('5/10');
    expect(output).toContain('Test Title');
  });

  it('shows 100% and newline when complete', () => {
    progressBar(10, 10, 'Complete');

    expect(mockStdoutWrite).toHaveBeenCalledTimes(2);
    const output = mockStdoutWrite.mock.calls[0][0] as string;
    expect(output).toContain('100%');
    expect(mockStdoutWrite.mock.calls[1][0]).toBe('\n');
  });

  it('truncates long titles', () => {
    const longTitle = 'This is a very long title that exceeds the maximum length allowed';
    progressBar(1, 10, longTitle);

    const output = mockStdoutWrite.mock.calls[0][0] as string;
    expect(output).toContain('...');
    expect(output.length).toBeLessThan(longTitle.length + 50);
  });

  it('pads short titles', () => {
    progressBar(1, 10, 'Short');

    const output = mockStdoutWrite.mock.calls[0][0] as string;
    expect(output).toContain('Short');
  });
});

describe('main', () => {
  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;
  let mockPage: any;
  let mockBrowser: any;
  let originalArgv: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    originalArgv = process.argv;
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Create mock page
    mockPage = {
      setUserAgent: vi.fn().mockResolvedValue(undefined),
      setViewport: vi.fn().mockResolvedValue(undefined),
      goto: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn(),
    };

    // Create mock browser
    mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(puppeteer.launch).mockResolvedValue(mockBrowser as any);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.argv = originalArgv;
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  it('exits with error when no start URL provided', async () => {
    process.argv = ['node', 'scrape.ts'];

    // Make process.exit throw to stop execution
    mockExit.mockImplementation(() => { throw new Error('process.exit called'); });

    const { main } = await import('./scrape.js');

    await expect(main()).rejects.toThrow('process.exit called');

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Usage:')
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('creates output directories', async () => {
    process.argv = ['node', 'scrape.ts', 'https://example.com/book'];

    // Mock page.evaluate for extractTocLinks to return empty array (navigation mode)
    mockPage.evaluate
      .mockResolvedValueOnce([]) // extractTocLinks
      .mockResolvedValueOnce({ title: 'Chapter 1', html: '<p>Content</p>', imageUrls: [] }) // extractChapterContent
      .mockResolvedValueOnce(null); // findNextChapterLink

    const { main } = await import('./scrape.js');
    await main();

    expect(fs.mkdir).toHaveBeenCalledWith('output/chapters', { recursive: true });
    expect(fs.mkdir).toHaveBeenCalledWith('output/images', { recursive: true });
  });

  it('launches browser with correct options', async () => {
    process.argv = ['node', 'scrape.ts', 'https://example.com/book'];

    mockPage.evaluate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ title: 'Chapter 1', html: '<p>Content</p>', imageUrls: [] })
      .mockResolvedValueOnce(null);

    const { main } = await import('./scrape.js');
    await main();

    expect(puppeteer.launch).toHaveBeenCalledWith({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  });

  it('writes metadata file after scraping', async () => {
    process.argv = ['node', 'scrape.ts', 'https://example.com/book'];

    mockPage.evaluate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ title: 'Chapter 1', html: '<p>Content</p>', imageUrls: [] })
      .mockResolvedValueOnce(null);

    const { main } = await import('./scrape.js');
    await main();

    expect(fs.writeFile).toHaveBeenCalledWith(
      'output/meta.json',
      expect.stringContaining('"startUrl"'),
      'utf-8'
    );
  });

  it('closes browser after completion', async () => {
    process.argv = ['node', 'scrape.ts', 'https://example.com/book'];

    mockPage.evaluate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ title: 'Chapter 1', html: '<p>Content</p>', imageUrls: [] })
      .mockResolvedValueOnce(null);

    const { main } = await import('./scrape.js');
    await main();

    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('closes browser even on error', async () => {
    process.argv = ['node', 'scrape.ts', 'https://example.com/book'];

    mockPage.goto.mockRejectedValueOnce(new Error('Network error'));

    const { main } = await import('./scrape.js');
    await main();

    expect(mockBrowser.close).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
