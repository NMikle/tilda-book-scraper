import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseArgs } from './pdf.js';

// Mock all external dependencies
vi.mock('fs/promises', () => ({
  access: vi.fn(),
  stat: vi.fn(),
}));

vi.mock('md-to-pdf', () => ({
  mdToPdf: vi.fn(),
}));

// Import mocked modules
import * as fs from 'fs/promises';
import { mdToPdf } from 'md-to-pdf';

describe('parseArgs', () => {
  it('returns showHelp false when no args provided', () => {
    expect(parseArgs([])).toEqual({ showHelp: false });
  });

  it('parses --help flag', () => {
    expect(parseArgs(['--help'])).toEqual({ showHelp: true });
  });

  it('parses -h flag', () => {
    expect(parseArgs(['-h'])).toEqual({ showHelp: true });
  });

  it('ignores unknown flags', () => {
    expect(parseArgs(['--unknown', 'value'])).toEqual({ showHelp: false });
  });
});

describe('main', () => {
  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  it('converts markdown to PDF successfully', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(mdToPdf).mockResolvedValue({ filename: 'output/book.pdf' } as any);
    vi.mocked(fs.stat).mockResolvedValue({ size: 1024 * 1024 * 2 } as any); // 2 MB

    const { main } = await import('./pdf.js');
    await main();

    expect(fs.access).toHaveBeenCalledWith('output/book.md');
    expect(mdToPdf).toHaveBeenCalledWith(
      { path: 'output/book.md' },
      expect.objectContaining({
        dest: 'output/book.pdf',
        pdf_options: expect.objectContaining({
          format: 'A4',
        }),
      })
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('PDF saved to')
    );
  });

  it('exits with error when book.md not found', async () => {
    vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
    mockExit.mockImplementation(() => { throw new Error('process.exit called'); });

    const { main } = await import('./pdf.js');

    await expect(main()).rejects.toThrow('process.exit called');

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('not found')
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('exits with error when PDF generation fails', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(mdToPdf).mockResolvedValue({ filename: undefined } as any);
    mockExit.mockImplementation(() => { throw new Error('process.exit called'); });

    const { main } = await import('./pdf.js');

    await expect(main()).rejects.toThrow('process.exit called');

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('PDF generation failed')
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('displays correct file size in output', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(mdToPdf).mockResolvedValue({ filename: 'output/book.pdf' } as any);
    vi.mocked(fs.stat).mockResolvedValue({ size: 5 * 1024 * 1024 } as any); // 5 MB

    const { main } = await import('./pdf.js');
    await main();

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('5.00 MB')
    );
  });

  it('extracts error message when mdToPdf throws an Error', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(mdToPdf).mockRejectedValue(new Error('Puppeteer crashed'));
    mockExit.mockImplementation(() => { throw new Error('process.exit called'); });

    const { main } = await import('./pdf.js');

    await expect(main()).rejects.toThrow('process.exit called');

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Puppeteer crashed')
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('handles non-Error exceptions from mdToPdf', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(mdToPdf).mockRejectedValue('string error');
    mockExit.mockImplementation(() => { throw new Error('process.exit called'); });

    const { main } = await import('./pdf.js');

    await expect(main()).rejects.toThrow('process.exit called');

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('string error')
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('shows help and exits with code 0 when --help flag is provided', async () => {
    const originalArgv = process.argv;
    process.argv = ['node', 'pdf.ts', '--help'];

    mockExit.mockImplementation(() => { throw new Error('process.exit called'); });

    const { main } = await import('./pdf.js');

    await expect(main()).rejects.toThrow('process.exit called');

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Usage:')
    );
    expect(mockExit).toHaveBeenCalledWith(0);

    process.argv = originalArgv;
  });
});
