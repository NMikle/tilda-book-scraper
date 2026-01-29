import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createImageStats,
  delay,
  downloadImage,
  type ImageStats,
  parseArgs,
  progressBar,
  saveImage,
} from "./scrape.js";

// Mock all external dependencies
vi.mock("puppeteer", () => ({
  default: {
    launch: vi.fn(),
  },
}));

vi.mock("fs/promises", () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("sharp", () => ({
  default: vi.fn(() => ({
    flatten: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toFile: vi.fn().mockResolvedValue(undefined),
  })),
}));

import * as fs from "node:fs/promises";
// Import mocked modules
import puppeteer from "puppeteer";

describe("parseArgs", () => {
  it("returns defaults when no args provided", () => {
    const result = parseArgs([]);
    expect(result).toEqual({
      startUrl: "",
      pageWait: 1000,
      chapterDelay: 1000,
      skipUrls: [],
      urlPattern: null,
      showHelp: false,
    });
  });

  it("parses start URL from positional argument", () => {
    const result = parseArgs(["https://example.com/book"]);
    expect(result.startUrl).toBe("https://example.com/book");
  });

  it("parses --wait flag", () => {
    const result = parseArgs(["https://example.com", "--wait", "2000"]);
    expect(result.pageWait).toBe(2000);
  });

  it("parses --delay flag", () => {
    const result = parseArgs(["https://example.com", "--delay", "1500"]);
    expect(result.chapterDelay).toBe(1500);
  });

  it("parses single --skip flag", () => {
    const result = parseArgs(["https://example.com", "--skip", "https://example.com/skip"]);
    expect(result.skipUrls).toEqual(["https://example.com/skip"]);
  });

  it("parses multiple --skip flags", () => {
    const result = parseArgs([
      "https://example.com",
      "--skip",
      "https://example.com/skip1",
      "--skip",
      "https://example.com/skip2",
    ]);
    expect(result.skipUrls).toEqual(["https://example.com/skip1", "https://example.com/skip2"]);
  });

  it("parses --url-pattern flag", () => {
    const result = parseArgs(["https://example.com", "--url-pattern", "*/page*.html"]);
    expect(result.urlPattern).toBe("*/page*.html");
  });

  it("parses all flags together", () => {
    const result = parseArgs([
      "https://example.com/book",
      "--wait",
      "500",
      "--delay",
      "750",
      "--skip",
      "https://example.com/exclude",
      "--url-pattern",
      "**/*.html",
    ]);
    expect(result).toEqual({
      startUrl: "https://example.com/book",
      pageWait: 500,
      chapterDelay: 750,
      skipUrls: ["https://example.com/exclude"],
      urlPattern: "**/*.html",
      showHelp: false,
    });
  });

  it("ignores flags without values", () => {
    const result = parseArgs(["https://example.com", "--wait"]);
    expect(result.pageWait).toBe(1000); // default
  });

  it("handles URL before flags", () => {
    const result = parseArgs(["https://example.com", "--wait", "2000"]);
    expect(result.startUrl).toBe("https://example.com");
    expect(result.pageWait).toBe(2000);
  });

  it("handles URL after flags", () => {
    const result = parseArgs(["--wait", "2000", "https://example.com"]);
    expect(result.startUrl).toBe("https://example.com");
    expect(result.pageWait).toBe(2000);
  });

  it("parses --help flag", () => {
    const result = parseArgs(["--help"]);
    expect(result.showHelp).toBe(true);
  });

  it("parses -h flag", () => {
    const result = parseArgs(["-h"]);
    expect(result.showHelp).toBe(true);
  });
});

describe("delay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after specified time", async () => {
    const promise = delay(1000);

    // Should not resolve immediately
    let resolved = false;
    promise.then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);

    // Advance time
    await vi.advanceTimersByTimeAsync(1000);

    await promise;
    expect(resolved).toBe(true);
  });

  it("works with zero delay", async () => {
    const promise = delay(0);
    await vi.advanceTimersByTimeAsync(0);
    await promise;
  });
});

describe("progressBar", () => {
  let mockStdoutWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockStdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    mockStdoutWrite.mockRestore();
  });

  it("writes progress bar to stdout", () => {
    progressBar(5, 10, "Test Title");

    expect(mockStdoutWrite).toHaveBeenCalled();
    const output = mockStdoutWrite.mock.calls[0][0] as string;
    expect(output).toContain("50%");
    expect(output).toContain("5/10");
    expect(output).toContain("Test Title");
  });

  it("shows 100% and newline when complete", () => {
    progressBar(10, 10, "Complete");

    expect(mockStdoutWrite).toHaveBeenCalledTimes(2);
    const output = mockStdoutWrite.mock.calls[0][0] as string;
    expect(output).toContain("100%");
    expect(mockStdoutWrite.mock.calls[1][0]).toBe("\n");
  });

  it("truncates long titles", () => {
    const longTitle = "This is a very long title that exceeds the maximum length allowed";
    progressBar(1, 10, longTitle);

    const output = mockStdoutWrite.mock.calls[0][0] as string;
    expect(output).toContain("...");
    expect(output.length).toBeLessThan(longTitle.length + 50);
  });

  it("pads short titles", () => {
    progressBar(1, 10, "Short");

    const output = mockStdoutWrite.mock.calls[0][0] as string;
    expect(output).toContain("Short");
  });
});

describe("createImageStats", () => {
  it("creates stats with initial values of zero", () => {
    const stats = createImageStats();
    expect(stats.nextIndex).toBe(0);
    expect(stats.failedCount).toBe(0);
  });

  it("creates independent stats objects", () => {
    const stats1 = createImageStats();
    const stats2 = createImageStats();
    stats1.nextIndex = 5;
    stats1.failedCount = 2;
    expect(stats2.nextIndex).toBe(0);
    expect(stats2.failedCount).toBe(0);
  });
});

describe("downloadImage", () => {
  let mockFetch: ReturnType<typeof vi.spyOn>;
  let stats: ImageStats;

  beforeEach(() => {
    stats = createImageStats();
    vi.clearAllMocks();
    mockFetch = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    mockFetch.mockRestore();
  });

  it("downloads and saves image successfully", async () => {
    const imageBuffer = Buffer.from("fake-image-data");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(imageBuffer),
    } as unknown as Response);

    const result = await downloadImage("https://static.tildacdn.com/tild1234/image.png", 0);

    expect(result).toBe("img-0000.jpg");
    expect(mockFetch).toHaveBeenCalledWith("https://static.tildacdn.com/tild1234/image.png");
  });

  it("transforms Tilda placeholder URLs before downloading", async () => {
    const imageBuffer = Buffer.from("fake-image-data");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(imageBuffer),
    } as unknown as Response);

    await downloadImage("https://thb.tildacdn.com/tild1234/-/empty/image.png", 1);

    // Verify the URL was transformed from thb (placeholder) to static (actual)
    expect(mockFetch).toHaveBeenCalledWith("https://static.tildacdn.com/tild1234/image.png");
  });

  it("falls back to original URL when transformed URL fails", async () => {
    const imageBuffer = Buffer.from("fake-image-data");
    // First call (transformed URL) fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);
    // Second call (original URL) succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(imageBuffer),
    } as unknown as Response);

    const result = await downloadImage("https://thb.tildacdn.com/tild1234/-/empty/image.png", 2);

    expect(result).toBe("img-0002.jpg");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns null and increments counter when both URLs fail", async () => {
    // First call (transformed URL) fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);
    // Second call (original URL) also fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    const result = await downloadImage("https://thb.tildacdn.com/tild1234/-/empty/image.png", 3, stats);

    expect(result).toBeNull();
    expect(stats.failedCount).toBe(1);
  });

  it("returns null and increments counter on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await downloadImage("https://static.tildacdn.com/tild1234/image.png", 4, stats);

    expect(result).toBeNull();
    expect(stats.failedCount).toBe(1);
  });

  it("handles non-Tilda URLs without transformation", async () => {
    const imageBuffer = Buffer.from("fake-image-data");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(imageBuffer),
    } as unknown as Response);

    await downloadImage("https://example.com/image.png", 5);

    expect(mockFetch).toHaveBeenCalledWith("https://example.com/image.png");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns null when non-Tilda URL fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    const result = await downloadImage("https://example.com/image.png", 6);

    expect(result).toBeNull();
    // No fallback for non-Tilda URLs, so only one fetch
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("saveImage", () => {
  let stats: ImageStats;

  beforeEach(() => {
    stats = createImageStats();
    vi.clearAllMocks();
  });

  it("saves image as JPEG with correct filename", async () => {
    const imageBuffer = Buffer.from("fake-image-data");

    const result = await saveImage(imageBuffer, 7);

    expect(result).toBe("img-0007.jpg");
  });

  it("pads image index with zeros", async () => {
    const imageBuffer = Buffer.from("fake-image-data");

    const result = await saveImage(imageBuffer, 123);

    expect(result).toBe("img-0123.jpg");
  });

  it("returns null and increments counter on sharp error", async () => {
    // Get the mocked sharp module and make toFile throw
    const sharp = (await import("sharp")).default;
    vi.mocked(sharp).mockReturnValueOnce({
      flatten: vi.fn().mockReturnThis(),
      jpeg: vi.fn().mockReturnThis(),
      toFile: vi.fn().mockRejectedValueOnce(new Error("Sharp error")),
    } as ReturnType<typeof sharp>);

    const imageBuffer = Buffer.from("corrupted-image-data");

    const result = await saveImage(imageBuffer, 8, stats);

    expect(result).toBeNull();
    expect(stats.failedCount).toBe(1);
  });
});

interface MockPage {
  setUserAgent: ReturnType<typeof vi.fn>;
  setViewport: ReturnType<typeof vi.fn>;
  goto: ReturnType<typeof vi.fn>;
  evaluate: ReturnType<typeof vi.fn>;
}

interface MockBrowser {
  newPage: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

describe("main", () => {
  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;
  let mockPage: MockPage;
  let mockBrowser: MockBrowser;
  let originalArgv: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    originalArgv = process.argv;
    mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

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

    vi.mocked(puppeteer.launch).mockResolvedValue(
      mockBrowser as unknown as Awaited<ReturnType<typeof puppeteer.launch>>,
    );
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.argv = originalArgv;
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  it("exits with error when no start URL provided", async () => {
    process.argv = ["node", "scrape.ts"];

    // Make process.exit throw to stop execution
    mockExit.mockImplementation(() => {
      throw new Error("process.exit called");
    });

    const { main } = await import("./scrape.js");

    await expect(main()).rejects.toThrow("process.exit called");

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("exits with error when URL format is invalid", async () => {
    process.argv = ["node", "scrape.ts", "not-a-valid-url"];

    mockExit.mockImplementation(() => {
      throw new Error("process.exit called");
    });

    const { main } = await import("./scrape.js");

    await expect(main()).rejects.toThrow("process.exit called");

    expect(mockConsoleError).toHaveBeenCalledWith("Error: Invalid URL format");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("exits with error when URL uses non-http protocol", async () => {
    process.argv = ["node", "scrape.ts", "ftp://example.com/book"];

    mockExit.mockImplementation(() => {
      throw new Error("process.exit called");
    });

    const { main } = await import("./scrape.js");

    await expect(main()).rejects.toThrow("process.exit called");

    expect(mockConsoleError).toHaveBeenCalledWith("Error: URL must use http or https protocol");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("creates output directories", async () => {
    process.argv = ["node", "scrape.ts", "https://example.com/book"];

    // Mock page.evaluate for extractTocLinks to return empty array (navigation mode)
    mockPage.evaluate
      .mockResolvedValueOnce([]) // extractTocLinks
      .mockResolvedValueOnce({ title: "Chapter 1", html: "<p>Content</p>", imageUrls: [] }) // extractChapterContent
      .mockResolvedValueOnce(null); // findNextChapterLink

    const { main } = await import("./scrape.js");
    await main();

    expect(fs.mkdir).toHaveBeenCalledWith("output/chapters", { recursive: true });
    expect(fs.mkdir).toHaveBeenCalledWith("output/images", { recursive: true });
  });

  it("launches browser with correct options", async () => {
    process.argv = ["node", "scrape.ts", "https://example.com/book"];

    mockPage.evaluate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ title: "Chapter 1", html: "<p>Content</p>", imageUrls: [] })
      .mockResolvedValueOnce(null);

    const { main } = await import("./scrape.js");
    await main();

    expect(puppeteer.launch).toHaveBeenCalledWith({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  });

  it("writes metadata file after scraping", async () => {
    process.argv = ["node", "scrape.ts", "https://example.com/book"];

    mockPage.evaluate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ title: "Chapter 1", html: "<p>Content</p>", imageUrls: [] })
      .mockResolvedValueOnce(null);

    const { main } = await import("./scrape.js");
    await main();

    expect(fs.writeFile).toHaveBeenCalledWith("output/meta.json", expect.stringContaining('"startUrl"'), "utf-8");
  });

  it("closes browser after completion", async () => {
    process.argv = ["node", "scrape.ts", "https://example.com/book"];

    mockPage.evaluate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ title: "Chapter 1", html: "<p>Content</p>", imageUrls: [] })
      .mockResolvedValueOnce(null);

    const { main } = await import("./scrape.js");
    await main();

    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it("closes browser even on error", async () => {
    process.argv = ["node", "scrape.ts", "https://example.com/book"];

    mockPage.goto.mockRejectedValueOnce(new Error("Network error"));

    const { main } = await import("./scrape.js");
    await main();

    expect(mockBrowser.close).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("handles empty page content gracefully", async () => {
    process.argv = ["node", "scrape.ts", "https://example.com/book"];

    mockPage.evaluate
      .mockResolvedValueOnce([]) // extractTocLinks - no TOC links
      .mockResolvedValueOnce({ title: "Empty Chapter", html: "", imageUrls: [] }) // empty content
      .mockResolvedValueOnce(null); // no next link

    const { main } = await import("./scrape.js");
    await main();

    // Should still write the chapter file even with empty content
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/output\/chapters\/001-empty-chapter\.md$/),
      expect.stringContaining("# Empty Chapter"),
      "utf-8",
    );
  });

  it("handles unicode in chapter titles", async () => {
    process.argv = ["node", "scrape.ts", "https://example.com/book"];

    mockPage.evaluate
      .mockResolvedValueOnce([]) // extractTocLinks
      .mockResolvedValueOnce({ title: "Глава 1: Введение", html: "<p>Содержимое</p>", imageUrls: [] })
      .mockResolvedValueOnce(null);

    const { main } = await import("./scrape.js");
    await main();

    // Verify unicode filename is created correctly
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/output\/chapters\/001-глава-1-введение\.md$/),
      expect.any(String),
      "utf-8",
    );
  });

  it("truncates extremely long titles in filenames", async () => {
    process.argv = ["node", "scrape.ts", "https://example.com/book"];

    const longTitle =
      "This is an extremely long chapter title that definitely exceeds the fifty character limit for filenames";
    mockPage.evaluate
      .mockResolvedValueOnce([]) // extractTocLinks
      .mockResolvedValueOnce({ title: longTitle, html: "<p>Content</p>", imageUrls: [] })
      .mockResolvedValueOnce(null);

    const { main } = await import("./scrape.js");
    await main();

    // Filename should be truncated (001- prefix + max 50 chars + .md)
    const writeCall = vi
      .mocked(fs.writeFile)
      .mock.calls.find((call) => typeof call[0] === "string" && call[0].includes("chapters"));
    expect(writeCall).toBeDefined();
    const filePath = writeCall?.[0] as string;
    const filename = filePath.split("/").pop() ?? "";
    // 001- (4) + sanitized title (max 50) + .md (3) = max 57 chars
    expect(filename.length).toBeLessThanOrEqual(57);
  });

  it("shows help and exits with code 0 when --help flag is provided", async () => {
    process.argv = ["node", "scrape.ts", "--help"];

    mockExit.mockImplementation(() => {
      throw new Error("process.exit called");
    });

    const { main } = await import("./scrape.js");

    await expect(main()).rejects.toThrow("process.exit called");

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it("shows warning when images fail to download", async () => {
    process.argv = ["node", "scrape.ts", "https://example.com/book"];

    // Mock fetch to fail for image downloads
    const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    mockPage.evaluate
      .mockResolvedValueOnce([]) // extractTocLinks
      .mockResolvedValueOnce({
        title: "Chapter with Images",
        html: "<p>Content</p>",
        imageUrls: ["https://example.com/image1.png", "https://example.com/image2.png"],
      })
      .mockResolvedValueOnce(null); // no next link

    const { main } = await import("./scrape.js");
    await main();

    // Should show warning about failed images
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("Warning: 2 image(s) failed to download"));

    mockFetch.mockRestore();
  });

  it("replaces remote image URLs with local paths when images download successfully", async () => {
    process.argv = ["node", "scrape.ts", "https://example.com/book"];

    // Mock fetch to succeed for image downloads
    const imageBuffer = Buffer.from("fake-image-data");
    const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(imageBuffer),
    } as unknown as Response);

    const imageUrl = "https://static.tildacdn.com/tild1234/photo.jpg";
    mockPage.evaluate
      .mockResolvedValueOnce([]) // extractTocLinks
      .mockResolvedValueOnce({
        title: "Chapter with Images",
        html: `<p>Content with image</p><img src="${imageUrl}">`,
        imageUrls: [imageUrl],
      })
      .mockResolvedValueOnce(null); // no next link

    const { main } = await import("./scrape.js");
    await main();

    // Should write chapter file with local image path
    const writeCall = vi
      .mocked(fs.writeFile)
      .mock.calls.find((call) => typeof call[0] === "string" && call[0].includes("chapters"));
    expect(writeCall).toBeDefined();
    const content = writeCall?.[1] as string;
    // Remote URL should be replaced with local path
    expect(content).toContain("../images/img-");
    expect(content).not.toContain(imageUrl);

    mockFetch.mockRestore();
  });
});
