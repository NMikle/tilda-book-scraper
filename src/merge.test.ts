import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ChapterMeta, fixImagePaths, generateTocEntry, parseArgs } from "./merge.js";

// Mock fs/promises
vi.mock("fs/promises", () => ({
  access: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  stat: vi.fn(),
}));

// Import mocked fs after vi.mock
import * as fs from "node:fs/promises";

describe("parseArgs", () => {
  it("returns default name when no args provided", () => {
    expect(parseArgs([])).toEqual({ name: "Book", showHelp: false });
  });

  it("parses --name flag", () => {
    expect(parseArgs(["--name", "My Book"])).toEqual({ name: "My Book", showHelp: false });
  });

  it("handles name with spaces", () => {
    expect(parseArgs(["--name", "My Amazing Book Title"])).toEqual({ name: "My Amazing Book Title", showHelp: false });
  });

  it("ignores unknown flags", () => {
    expect(parseArgs(["--unknown", "value", "--name", "Test"])).toEqual({ name: "Test", showHelp: false });
  });

  it("uses default when --name has no value", () => {
    expect(parseArgs(["--name"])).toEqual({ name: "Book", showHelp: false });
  });

  it("uses last --name value when multiple provided", () => {
    expect(parseArgs(["--name", "First", "--name", "Second"])).toEqual({ name: "Second", showHelp: false });
  });

  it("parses --help flag", () => {
    expect(parseArgs(["--help"])).toEqual({ name: "Book", showHelp: true });
  });

  it("parses -h flag", () => {
    expect(parseArgs(["-h"])).toEqual({ name: "Book", showHelp: true });
  });
});

describe("fixImagePaths", () => {
  it("converts ../images/ to ./images/", () => {
    const input = "![alt](../images/photo.jpg)";
    expect(fixImagePaths(input)).toBe("![alt](./images/photo.jpg)");
  });

  it("handles multiple image references", () => {
    const input = "![a](../images/1.jpg)\n![b](../images/2.jpg)";
    expect(fixImagePaths(input)).toBe("![a](./images/1.jpg)\n![b](./images/2.jpg)");
  });

  it("preserves other paths unchanged", () => {
    const input = "![alt](./other/path.jpg)";
    expect(fixImagePaths(input)).toBe("![alt](./other/path.jpg)");
  });

  it("handles content without images", () => {
    const input = "# Chapter 1\n\nSome text content.";
    expect(fixImagePaths(input)).toBe("# Chapter 1\n\nSome text content.");
  });

  it("handles mixed content", () => {
    const input = "# Title\n\n![img](../images/test.jpg)\n\nText after image.";
    expect(fixImagePaths(input)).toBe("# Title\n\n![img](./images/test.jpg)\n\nText after image.");
  });
});

describe("generateTocEntry", () => {
  it("generates numbered markdown link", () => {
    const chapter: ChapterMeta = {
      index: 0,
      title: "Introduction",
      url: "https://example.com/intro",
      filename: "001-introduction.md",
    };
    expect(generateTocEntry(chapter)).toBe("1. [Introduction](#introduction)");
  });

  it("handles Cyrillic titles", () => {
    const chapter: ChapterMeta = {
      index: 4,
      title: "Скелетные мышцы",
      url: "https://example.com/muscles",
      filename: "005-muscles.md",
    };
    expect(generateTocEntry(chapter)).toBe("5. [Скелетные мышцы](#скелетные-мышцы)");
  });

  it("handles titles with special characters", () => {
    const chapter: ChapterMeta = {
      index: 9,
      title: "Chapter 10: The End (Final)",
      url: "https://example.com/end",
      filename: "010-end.md",
    };
    expect(generateTocEntry(chapter)).toBe("10. [Chapter 10: The End (Final)](#chapter-10-the-end-final)");
  });

  it("handles titles with trailing spaces", () => {
    const chapter: ChapterMeta = {
      index: 1,
      title: "Title with space ",
      url: "https://example.com/test",
      filename: "002-test.md",
    };
    expect(generateTocEntry(chapter)).toBe("2. [Title with space ](#title-with-space)");
  });

  it("preserves hyphens in titles", () => {
    const chapter: ChapterMeta = {
      index: 33,
      title: "Митохондрии - строение",
      url: "https://example.com/mito",
      filename: "034-mito.md",
    };
    expect(generateTocEntry(chapter)).toBe("34. [Митохондрии - строение](#митохондрии---строение)");
  });
});

describe("main", () => {
  const mockMeta = {
    scrapedAt: "2024-01-15T10:00:00.000Z",
    startUrl: "https://example.com/book",
    chapters: [
      { index: 0, title: "Chapter 1", url: "https://example.com/ch1", filename: "001-chapter-1.md" },
      { index: 1, title: "Chapter 2", url: "https://example.com/ch2", filename: "002-chapter-2.md" },
    ],
  };

  const mockChapter1 = "# Chapter 1\n\nContent with ![img](../images/photo.jpg)";
  const mockChapter2 = "# Chapter 2\n\nMore content";

  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  it("merges chapters successfully", async () => {
    const { main } = await import("./merge.js");

    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      if (String(path).includes("meta.json")) return JSON.stringify(mockMeta);
      if (String(path).includes("001-chapter-1.md")) return mockChapter1;
      if (String(path).includes("002-chapter-2.md")) return mockChapter2;
      throw new Error("File not found");
    });
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.stat).mockResolvedValue({ size: 1024 } as any);

    await main();

    expect(fs.access).toHaveBeenCalledWith("output/meta.json");
    expect(fs.writeFile).toHaveBeenCalledWith("output/book.md", expect.stringContaining("# Book"), "utf-8");
    expect(fs.writeFile).toHaveBeenCalledWith(
      "output/book.md",
      expect.stringContaining("## Table of Contents"),
      "utf-8",
    );
    // Verify image paths were fixed
    expect(fs.writeFile).toHaveBeenCalledWith("output/book.md", expect.stringContaining("./images/photo.jpg"), "utf-8");
    expect(mockConsoleLog).toHaveBeenCalledWith("Merging 2 chapters...");
  });

  it("exits with error when meta.json not found", async () => {
    const { main } = await import("./merge.js");

    vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

    await main();

    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("not found"));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("exits with error when no chapters in metadata", async () => {
    const { main } = await import("./merge.js");

    const emptyMeta = { ...mockMeta, chapters: [] };
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(emptyMeta));

    await main();

    expect(mockConsoleError).toHaveBeenCalledWith("Error: No chapters found in metadata.");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("exits with error when meta.json is missing scrapedAt field", async () => {
    const { main } = await import("./merge.js");

    const invalidMeta = { startUrl: "https://example.com", chapters: [] };
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(invalidMeta));
    mockExit.mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await expect(main()).rejects.toThrow("process.exit called");

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining("Invalid output/meta.json: Missing or invalid field: scrapedAt"),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("exits with error when meta.json is missing startUrl field", async () => {
    const { main } = await import("./merge.js");

    const invalidMeta = { scrapedAt: "2024-01-01", chapters: [] };
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(invalidMeta));
    mockExit.mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await expect(main()).rejects.toThrow("process.exit called");

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining("Invalid output/meta.json: Missing or invalid field: startUrl"),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("exits with error when chapter is missing required fields", async () => {
    const { main } = await import("./merge.js");

    const invalidMeta = {
      scrapedAt: "2024-01-01",
      startUrl: "https://example.com",
      chapters: [{ index: 0, title: "Chapter 1" }], // missing url and filename
    };
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(invalidMeta));
    mockExit.mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await expect(main()).rejects.toThrow("process.exit called");

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining("Invalid output/meta.json: chapters[0].url must be a string"),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("skips missing chapter files with warning", async () => {
    const { main } = await import("./merge.js");

    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      if (String(path).includes("meta.json")) return JSON.stringify(mockMeta);
      if (String(path).includes("001-chapter-1.md")) return mockChapter1;
      // Chapter 2 is missing
      throw new Error("ENOENT");
    });
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.stat).mockResolvedValue({ size: 512 } as any);

    await main();

    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("Warning: Could not read 002-chapter-2.md"));
    // Should still write output with available chapters
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it("generates correct TOC with anchors", async () => {
    const { main } = await import("./merge.js");

    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      if (String(path).includes("meta.json")) return JSON.stringify(mockMeta);
      if (String(path).includes("001-chapter-1.md")) return mockChapter1;
      if (String(path).includes("002-chapter-2.md")) return mockChapter2;
      throw new Error("File not found");
    });
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.stat).mockResolvedValue({ size: 1024 } as any);

    await main();

    const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
    const content = writeCall[1] as string;

    expect(content).toContain("1. [Chapter 1](#chapter-1)");
    expect(content).toContain("2. [Chapter 2](#chapter-2)");
  });

  it("shows help and exits with code 0 when --help flag is provided", async () => {
    const originalArgv = process.argv;
    process.argv = ["node", "merge.ts", "--help"];

    mockExit.mockImplementation(() => {
      throw new Error("process.exit called");
    });

    const { main } = await import("./merge.js");

    await expect(main()).rejects.toThrow("process.exit called");

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
    expect(mockExit).toHaveBeenCalledWith(0);

    process.argv = originalArgv;
  });
});
