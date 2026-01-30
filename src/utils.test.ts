import { describe, expect, it } from "vitest";
import {
  deduplicateContentParts,
  generateAnchor,
  getBaseUrl,
  getMultiStringArg,
  getNullableStringArg,
  getNumberArg,
  getPositionalArg,
  getStringArg,
  globToRegex,
  hasHelpFlag,
  resolveUrl,
  sanitizeFilename,
  transformTildaImageUrl,
  validateBookMeta,
  validateUrl,
} from "./utils.js";

describe("globToRegex", () => {
  it("matches exact strings", () => {
    const regex = globToRegex("hello");
    expect(regex.test("hello")).toBe(true);
    expect(regex.test("hello!")).toBe(false);
    expect(regex.test("say hello")).toBe(false);
  });

  it("handles * wildcard (matches anything except /)", () => {
    const regex = globToRegex("*.html");
    expect(regex.test("page.html")).toBe(true);
    expect(regex.test("index.html")).toBe(true);
    expect(regex.test(".html")).toBe(true);
    expect(regex.test("path/page.html")).toBe(false);
  });

  it("handles ** wildcard (matches anything including /)", () => {
    // ** matches any characters including /
    const regex = globToRegex("**page*.html");
    expect(regex.test("page1.html")).toBe(true);
    expect(regex.test("https://example.com/page123.html")).toBe(true);
    expect(regex.test("https://example.com/path/page456.html")).toBe(true);

    // **/file means "slash then file" at any path depth
    const regex2 = globToRegex("**/page*.html");
    expect(regex2.test("/page1.html")).toBe(true);
    expect(regex2.test("https://example.com/page123.html")).toBe(true);
    expect(regex2.test("page1.html")).toBe(false); // no leading /
  });

  it("handles ? wildcard (matches single char)", () => {
    const regex = globToRegex("page?.html");
    expect(regex.test("page1.html")).toBe(true);
    expect(regex.test("pageA.html")).toBe(true);
    expect(regex.test("page.html")).toBe(false);
    expect(regex.test("page12.html")).toBe(false);
  });

  it("escapes regex special characters", () => {
    const regex = globToRegex("file.name+test.html");
    expect(regex.test("file.name+test.html")).toBe(true);
    expect(regex.test("fileXname+test.html")).toBe(false);
  });

  it("handles URL patterns", () => {
    const regex = globToRegex("*/page*.html");
    expect(regex.test("https://example.com/page123.html")).toBe(false); // * doesn't match /

    const regex2 = globToRegex("**/page*.html");
    expect(regex2.test("https://example.com/page123.html")).toBe(true);
  });
});

describe("transformTildaImageUrl", () => {
  it("transforms placeholder URLs to actual image URLs", () => {
    const placeholder = "https://thb.tildacdn.com/tild3836-6132-4862-a436-623432383435/-/empty/photo.jpg";
    const expected = "https://static.tildacdn.com/tild3836-6132-4862-a436-623432383435/photo.jpg";
    expect(transformTildaImageUrl(placeholder)).toBe(expected);
  });

  it("returns non-placeholder URLs unchanged", () => {
    const directUrl = "https://static.tildacdn.com/tild1234/image.png";
    expect(transformTildaImageUrl(directUrl)).toBe(directUrl);
  });

  it("returns non-Tilda URLs unchanged", () => {
    const externalUrl = "https://example.com/image.png";
    expect(transformTildaImageUrl(externalUrl)).toBe(externalUrl);
  });

  it("handles various image extensions", () => {
    const png = "https://thb.tildacdn.com/tild1234/-/empty/image.png";
    expect(transformTildaImageUrl(png)).toBe("https://static.tildacdn.com/tild1234/image.png");

    const jpg = "https://thb.tildacdn.com/tild1234/-/empty/photo.jpg";
    expect(transformTildaImageUrl(jpg)).toBe("https://static.tildacdn.com/tild1234/photo.jpg");

    const webp = "https://thb.tildacdn.com/tild1234/-/empty/image.webp";
    expect(transformTildaImageUrl(webp)).toBe("https://static.tildacdn.com/tild1234/image.webp");
  });
});

describe("sanitizeFilename", () => {
  it("converts to lowercase and replaces special chars with dashes", () => {
    expect(sanitizeFilename("Hello World!")).toBe("hello-world");
  });

  it("handles Cyrillic text", () => {
    expect(sanitizeFilename("Привет Мир")).toBe("привет-мир");
  });

  it("removes leading and trailing dashes", () => {
    expect(sanitizeFilename("---test---")).toBe("test");
  });

  it("truncates to 50 characters", () => {
    const longTitle = "This is a very long title that exceeds fifty characters limit";
    expect(sanitizeFilename(longTitle).length).toBeLessThanOrEqual(50);
  });

  it("handles mixed content", () => {
    expect(sanitizeFilename("Chapter 1: Введение (Introduction)")).toBe("chapter-1-введение-introduction");
  });

  it("collapses multiple special chars into single dash", () => {
    expect(sanitizeFilename("test...file___name")).toBe("test-file-name");
  });
});

describe("getBaseUrl", () => {
  it("extracts protocol and host from URL", () => {
    expect(getBaseUrl("https://example.com/path/to/page")).toBe("https://example.com");
  });

  it("preserves port if present", () => {
    expect(getBaseUrl("http://localhost:3000/page")).toBe("http://localhost:3000");
  });

  it("handles URLs with query strings", () => {
    expect(getBaseUrl("https://example.com/page?foo=bar")).toBe("https://example.com");
  });

  it("handles URLs with fragments", () => {
    expect(getBaseUrl("https://example.com/page#section")).toBe("https://example.com");
  });

  it("throws for invalid URLs", () => {
    expect(() => getBaseUrl("not-a-url")).toThrow();
  });
});

describe("generateAnchor", () => {
  it("converts to lowercase and replaces spaces with dashes", () => {
    expect(generateAnchor("Hello World")).toBe("hello-world");
  });

  it("handles Cyrillic text", () => {
    expect(generateAnchor("Скелетные мышцы и их функции")).toBe("скелетные-мышцы-и-их-функции");
  });

  it("strips trailing spaces and punctuation (fixes broken TOC links)", () => {
    // These are the actual problematic titles from the book
    expect(generateAnchor("Опорно-двигательная система, суставы, фасции ")).toBe(
      "опорно-двигательная-система-суставы-фасции",
    );
    expect(generateAnchor("Нейромышечный синапс ")).toBe("нейромышечный-синапс");
    expect(generateAnchor("Фазы нейропластичности ")).toBe("фазы-нейропластичности");
  });

  it("strips leading spaces and punctuation", () => {
    expect(generateAnchor(" Leading space")).toBe("leading-space");
    expect(generateAnchor("...Title")).toBe("title");
  });

  it("handles punctuation at end of title", () => {
    expect(generateAnchor("Система скелетных рычагов, моменты сил, типы рычагов.")).toBe(
      "система-скелетных-рычагов-моменты-сил-типы-рычагов",
    );
  });

  it("handles parentheses in titles", () => {
    expect(generateAnchor("Миотатический рефлекс (рефлекс на растяжение)")).toBe(
      "миотатический-рефлекс-рефлекс-на-растяжение",
    );
    expect(generateAnchor("Центральное (ЦНС) утомление ")).toBe("центральное-цнс-утомление");
  });

  it("preserves hyphens from original title (GitHub/CommonMark style)", () => {
    // Space-hyphen-space becomes three hyphens (space→hyphen, original hyphen, space→hyphen)
    expect(generateAnchor("Title - with dash")).toBe("title---with-dash");
    expect(generateAnchor("Митохондрии - строение")).toBe("митохондрии---строение");
  });

  it("handles mixed content", () => {
    expect(generateAnchor("Chapter 1: Introduction (Part 1)")).toBe("chapter-1-introduction-part-1");
  });
});

describe("deduplicateContentParts", () => {
  it("removes exact duplicate text content", () => {
    const parts = [
      "<p>Hello world</p>",
      "<p>Unique content</p>",
      "<p>Hello world</p>", // duplicate
    ];
    const result = deduplicateContentParts(parts);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe("<p>Hello world</p>");
    expect(result[1]).toBe("<p>Unique content</p>");
  });

  it("removes duplicates with different HTML structure but same text", () => {
    const parts = [
      '<p class="foo">Same text</p>',
      "<div>Unique</div>",
      '<span class="bar">Same text</span>', // same text, different markup
    ];
    const result = deduplicateContentParts(parts);
    expect(result).toHaveLength(2);
  });

  it("preserves images (does not filter them as empty content)", () => {
    const parts = ['<img src="image1.jpg" alt="">', "<p>Some text</p>", '<img src="image2.jpg" alt="">'];
    const result = deduplicateContentParts(parts);
    expect(result).toHaveLength(3);
  });

  it("deduplicates images by src attribute", () => {
    const parts = [
      '<img src="same-image.jpg" alt="">',
      "<p>Text between</p>",
      '<img src="same-image.jpg" alt="different alt">', // same src, different alt
    ];
    const result = deduplicateContentParts(parts);
    expect(result).toHaveLength(2);
  });

  it("filters out empty strings", () => {
    const parts = ["", "   ", "<p>Content</p>", "\n\t"];
    const result = deduplicateContentParts(parts);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("<p>Content</p>");
  });

  it("preserves order (keeps first occurrence)", () => {
    const parts = ["<p>First</p>", "<p>Second</p>", "<p>First</p>", "<p>Third</p>"];
    const result = deduplicateContentParts(parts);
    expect(result).toEqual(["<p>First</p>", "<p>Second</p>", "<p>Third</p>"]);
  });

  it("handles content with Cyrillic text", () => {
    const parts = [
      "<p>В программе: физиология</p>",
      "<p>Уникальный контент</p>",
      "<p>В программе: физиология</p>", // duplicate
    ];
    const result = deduplicateContentParts(parts);
    expect(result).toHaveLength(2);
  });
});

describe("setupSignalHandlers", () => {
  it("is exported from utils", async () => {
    const utils = await import("./utils.js");
    expect(typeof utils.setupSignalHandlers).toBe("function");
  });
});

describe("onInterrupt", () => {
  it("is exported from utils", async () => {
    const utils = await import("./utils.js");
    expect(typeof utils.onInterrupt).toBe("function");
  });
});

describe("validateUrl", () => {
  it("accepts valid http URLs", () => {
    expect(validateUrl("http://example.com")).toEqual({ isValid: true });
    expect(validateUrl("http://example.com/path")).toEqual({ isValid: true });
    expect(validateUrl("http://example.com:8080/path")).toEqual({ isValid: true });
  });

  it("accepts valid https URLs", () => {
    expect(validateUrl("https://example.com")).toEqual({ isValid: true });
    expect(validateUrl("https://example.com/path/to/page")).toEqual({ isValid: true });
    expect(validateUrl("https://sub.example.com")).toEqual({ isValid: true });
  });

  it("rejects empty or missing URLs", () => {
    expect(validateUrl("")).toEqual({ isValid: false, error: "URL is required" });
    expect(validateUrl(null as unknown as string)).toEqual({ isValid: false, error: "URL is required" });
    expect(validateUrl(undefined as unknown as string)).toEqual({ isValid: false, error: "URL is required" });
  });

  it("rejects invalid URL format", () => {
    expect(validateUrl("not-a-url")).toEqual({ isValid: false, error: "Invalid URL format" });
    expect(validateUrl("example.com")).toEqual({ isValid: false, error: "Invalid URL format" });
    expect(validateUrl("://missing-protocol.com")).toEqual({ isValid: false, error: "Invalid URL format" });
  });

  it("rejects non-http/https protocols", () => {
    expect(validateUrl("ftp://example.com")).toEqual({ isValid: false, error: "URL must use http or https protocol" });
    expect(validateUrl("file:///path/to/file")).toEqual({
      isValid: false,
      error: "URL must use http or https protocol",
    });
    expect(validateUrl("mailto:test@example.com")).toEqual({
      isValid: false,
      error: "URL must use http or https protocol",
    });
  });
});

describe("validateBookMeta", () => {
  const validMeta = {
    scrapedAt: "2024-01-01T00:00:00.000Z",
    startUrl: "https://example.com/book",
    chapters: [
      { index: 0, title: "Chapter 1", url: "https://example.com/ch1", filename: "001-chapter-1.md" },
      { index: 1, title: "Chapter 2", url: "https://example.com/ch2", filename: "002-chapter-2.md" },
    ],
  };

  it("accepts valid meta.json structure", () => {
    expect(validateBookMeta(validMeta)).toEqual({ isValid: true });
  });

  it("accepts meta with empty chapters array", () => {
    const meta = { ...validMeta, chapters: [] };
    expect(validateBookMeta(meta)).toEqual({ isValid: true });
  });

  it("rejects null or non-object", () => {
    expect(validateBookMeta(null)).toEqual({ isValid: false, error: "meta.json must be an object" });
    expect(validateBookMeta(undefined)).toEqual({ isValid: false, error: "meta.json must be an object" });
    expect(validateBookMeta("string")).toEqual({ isValid: false, error: "meta.json must be an object" });
    expect(validateBookMeta(123)).toEqual({ isValid: false, error: "meta.json must be an object" });
  });

  it("rejects missing scrapedAt", () => {
    const meta = { startUrl: "https://example.com", chapters: [] };
    expect(validateBookMeta(meta)).toEqual({
      isValid: false,
      error: "Missing or invalid field: scrapedAt (expected string)",
    });
  });

  it("rejects invalid scrapedAt type", () => {
    const meta = { ...validMeta, scrapedAt: 123 };
    expect(validateBookMeta(meta)).toEqual({
      isValid: false,
      error: "Missing or invalid field: scrapedAt (expected string)",
    });
  });

  it("rejects missing startUrl", () => {
    const meta = { scrapedAt: "2024-01-01", chapters: [] };
    expect(validateBookMeta(meta)).toEqual({
      isValid: false,
      error: "Missing or invalid field: startUrl (expected string)",
    });
  });

  it("rejects missing chapters array", () => {
    const meta = { scrapedAt: "2024-01-01", startUrl: "https://example.com" };
    expect(validateBookMeta(meta)).toEqual({
      isValid: false,
      error: "Missing or invalid field: chapters (expected array)",
    });
  });

  it("rejects chapters that is not an array", () => {
    const meta = { scrapedAt: "2024-01-01", startUrl: "https://example.com", chapters: "not-array" };
    expect(validateBookMeta(meta)).toEqual({
      isValid: false,
      error: "Missing or invalid field: chapters (expected array)",
    });
  });

  it("rejects chapter that is not an object", () => {
    const meta = { scrapedAt: "2024-01-01", startUrl: "https://example.com", chapters: [null] };
    expect(validateBookMeta(meta)).toEqual({ isValid: false, error: "chapters[0] must be an object" });
  });

  it("rejects chapter that is a primitive value", () => {
    const meta = { scrapedAt: "2024-01-01", startUrl: "https://example.com", chapters: ["string-chapter"] };
    expect(validateBookMeta(meta)).toEqual({ isValid: false, error: "chapters[0] must be an object" });
  });

  it("rejects chapter with missing index", () => {
    const meta = {
      ...validMeta,
      chapters: [{ title: "Ch1", url: "https://example.com", filename: "001.md" }],
    };
    expect(validateBookMeta(meta)).toEqual({ isValid: false, error: "chapters[0].index must be a number" });
  });

  it("rejects chapter with missing title", () => {
    const meta = {
      ...validMeta,
      chapters: [{ index: 0, url: "https://example.com", filename: "001.md" }],
    };
    expect(validateBookMeta(meta)).toEqual({ isValid: false, error: "chapters[0].title must be a string" });
  });

  it("rejects chapter with missing url", () => {
    const meta = {
      ...validMeta,
      chapters: [{ index: 0, title: "Ch1", filename: "001.md" }],
    };
    expect(validateBookMeta(meta)).toEqual({ isValid: false, error: "chapters[0].url must be a string" });
  });

  it("rejects chapter with missing filename", () => {
    const meta = {
      ...validMeta,
      chapters: [{ index: 0, title: "Ch1", url: "https://example.com" }],
    };
    expect(validateBookMeta(meta)).toEqual({ isValid: false, error: "chapters[0].filename must be a string" });
  });

  it("reports correct index for invalid chapter", () => {
    const meta = {
      ...validMeta,
      chapters: [
        { index: 0, title: "Ch1", url: "https://example.com", filename: "001.md" },
        { index: 1, title: "Ch2", url: "https://example.com" }, // missing filename
      ],
    };
    expect(validateBookMeta(meta)).toEqual({ isValid: false, error: "chapters[1].filename must be a string" });
  });
});

describe("hasHelpFlag", () => {
  it("returns true for --help", () => {
    expect(hasHelpFlag(["--help"])).toBe(true);
    expect(hasHelpFlag(["arg", "--help"])).toBe(true);
  });

  it("returns true for -h", () => {
    expect(hasHelpFlag(["-h"])).toBe(true);
    expect(hasHelpFlag(["arg", "-h", "other"])).toBe(true);
  });

  it("returns false when no help flag present", () => {
    expect(hasHelpFlag([])).toBe(false);
    expect(hasHelpFlag(["--name", "value"])).toBe(false);
  });
});

describe("getStringArg", () => {
  it("returns value when flag is present", () => {
    expect(getStringArg(["--name", "MyBook"], "--name", "default")).toBe("MyBook");
  });

  it("returns default when flag is missing", () => {
    expect(getStringArg(["--other", "value"], "--name", "default")).toBe("default");
  });

  it("returns default when flag has no value", () => {
    expect(getStringArg(["--name"], "--name", "default")).toBe("default");
  });

  it("returns default when value looks like a flag", () => {
    expect(getStringArg(["--name", "--other"], "--name", "default")).toBe("default");
  });

  it("handles flag in middle of args", () => {
    expect(getStringArg(["url", "--name", "Book", "--wait", "1000"], "--name", "default")).toBe("Book");
  });

  it("returns last value when flag appears multiple times", () => {
    expect(getStringArg(["--name", "First", "--name", "Second"], "--name", "default")).toBe("Second");
  });
});

describe("getNullableStringArg", () => {
  it("returns value when flag is present", () => {
    expect(getNullableStringArg(["--pattern", "*.html"], "--pattern")).toBe("*.html");
  });

  it("returns null when flag is missing", () => {
    expect(getNullableStringArg(["--other", "value"], "--pattern")).toBeNull();
  });

  it("returns null when flag has no value", () => {
    expect(getNullableStringArg(["--pattern"], "--pattern")).toBeNull();
  });
});

describe("getNumberArg", () => {
  it("returns parsed number when flag is present", () => {
    expect(getNumberArg(["--wait", "2000"], "--wait", 1000)).toBe(2000);
  });

  it("returns default when flag is missing", () => {
    expect(getNumberArg(["--other", "500"], "--wait", 1000)).toBe(1000);
  });

  it("returns default when value is not a number", () => {
    expect(getNumberArg(["--wait", "abc"], "--wait", 1000)).toBe(1000);
  });

  it("returns default when flag has no value", () => {
    expect(getNumberArg(["--wait"], "--wait", 1000)).toBe(1000);
  });

  it("handles zero as valid value", () => {
    expect(getNumberArg(["--wait", "0"], "--wait", 1000)).toBe(0);
  });
});

describe("getMultiStringArg", () => {
  it("returns empty array when flag is missing", () => {
    expect(getMultiStringArg(["--other", "value"], "--skip")).toEqual([]);
  });

  it("returns single value", () => {
    expect(getMultiStringArg(["--skip", "url1"], "--skip")).toEqual(["url1"]);
  });

  it("returns multiple values", () => {
    expect(getMultiStringArg(["--skip", "url1", "--skip", "url2"], "--skip")).toEqual(["url1", "url2"]);
  });

  it("ignores flags without values", () => {
    expect(getMultiStringArg(["--skip", "--other"], "--skip")).toEqual([]);
  });

  it("handles mixed args", () => {
    expect(getMultiStringArg(["url", "--skip", "a", "--wait", "1000", "--skip", "b"], "--skip")).toEqual(["a", "b"]);
  });
});

describe("getPositionalArg", () => {
  it("returns first non-flag argument", () => {
    expect(getPositionalArg(["https://example.com"])).toBe("https://example.com");
  });

  it("returns empty string when no positional arg", () => {
    expect(getPositionalArg(["--help"])).toBe("");
    expect(getPositionalArg([])).toBe("");
  });

  it("skips values of known flags", () => {
    expect(getPositionalArg(["--wait", "1000", "https://example.com"], ["--wait"])).toBe("https://example.com");
  });

  it("skips multiple known flag values", () => {
    expect(getPositionalArg(["--wait", "1000", "--delay", "500", "https://example.com"], ["--wait", "--delay"])).toBe(
      "https://example.com",
    );
  });

  it("returns first positional even if not URL", () => {
    expect(getPositionalArg(["positional", "--flag"])).toBe("positional");
  });

  it("skips short flags", () => {
    expect(getPositionalArg(["-h", "positional"])).toBe("positional");
  });

  it("handles positional before flags", () => {
    expect(getPositionalArg(["https://example.com", "--wait", "1000"], ["--wait"])).toBe("https://example.com");
  });
});

describe("resolveUrl", () => {
  const baseUrl = "https://example.com";
  const baseUrlWithPath = "https://example.com/dir/page.html";

  it("resolves absolute URLs (returns as-is)", () => {
    expect(resolveUrl("https://other.com/page", baseUrl)).toBe("https://other.com/page");
    expect(resolveUrl("http://other.com/page", baseUrl)).toBe("http://other.com/page");
  });

  it("resolves root-relative URLs", () => {
    expect(resolveUrl("/page", baseUrl)).toBe("https://example.com/page");
    expect(resolveUrl("/path/to/page", baseUrl)).toBe("https://example.com/path/to/page");
    expect(resolveUrl("/page", baseUrlWithPath)).toBe("https://example.com/page");
  });

  it("resolves relative URLs against base path", () => {
    expect(resolveUrl("page", "https://example.com/dir/")).toBe("https://example.com/dir/page");
    expect(resolveUrl("page.html", "https://example.com/dir/index.html")).toBe("https://example.com/dir/page.html");
    expect(resolveUrl("../page", "https://example.com/dir/sub/")).toBe("https://example.com/dir/page");
  });

  it("handles URLs with query strings", () => {
    expect(resolveUrl("/page?foo=bar", baseUrl)).toBe("https://example.com/page?foo=bar");
    expect(resolveUrl("?query=value", "https://example.com/page")).toBe("https://example.com/page?query=value");
  });

  it("handles URLs with fragments", () => {
    expect(resolveUrl("/page#section", baseUrl)).toBe("https://example.com/page#section");
    expect(resolveUrl("#anchor", "https://example.com/page")).toBe("https://example.com/page#anchor");
  });

  it("handles protocol-relative URLs", () => {
    expect(resolveUrl("//other.com/page", baseUrl)).toBe("https://other.com/page");
    expect(resolveUrl("//other.com/page", "http://example.com")).toBe("http://other.com/page");
  });

  it("normalizes double slashes in paths", () => {
    expect(resolveUrl("//example.com//page", baseUrl)).toBe("https://example.com//page");
  });

  it("handles edge case with trailing slash on base", () => {
    expect(resolveUrl("page", "https://example.com/")).toBe("https://example.com/page");
    expect(resolveUrl("page", "https://example.com")).toBe("https://example.com/page");
  });

  it("returns null for invalid URLs", () => {
    expect(resolveUrl("", "not-a-url")).toBeNull();
    expect(resolveUrl("http://", baseUrl)).toBeNull();
    expect(resolveUrl("https://", baseUrl)).toBeNull();
  });

  it("handles empty href", () => {
    expect(resolveUrl("", baseUrl)).toBe("https://example.com/");
    expect(resolveUrl("", baseUrlWithPath)).toBe("https://example.com/dir/page.html");
  });
});
