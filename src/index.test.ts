import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatDuration, parseArgs, run } from "./index.js";

// Mock child_process
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "node:child_process";

describe("formatDuration", () => {
  it("formats seconds only", () => {
    expect(formatDuration(5000)).toBe("5s");
    expect(formatDuration(45000)).toBe("45s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(65000)).toBe("1m 5s");
    expect(formatDuration(125000)).toBe("2m 5s");
  });

  it("handles zero seconds in minutes", () => {
    expect(formatDuration(60000)).toBe("1m 0s");
    expect(formatDuration(120000)).toBe("2m 0s");
  });

  it("handles zero duration", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("rounds down milliseconds", () => {
    expect(formatDuration(5999)).toBe("5s");
    expect(formatDuration(65999)).toBe("1m 5s");
  });
});

describe("parseArgs", () => {
  it("returns defaults when no args provided", () => {
    const result = parseArgs([]);
    expect(result).toEqual({
      startUrl: "",
      name: "Book",
      wait: 1000,
      delay: 1000,
      skipUrls: [],
      urlPattern: null,
      showHelp: false,
    });
  });

  it("parses start URL from positional argument", () => {
    const result = parseArgs(["https://example.com/book"]);
    expect(result.startUrl).toBe("https://example.com/book");
  });

  it("parses --name flag", () => {
    const result = parseArgs(["https://example.com", "--name", "My Book"]);
    expect(result.name).toBe("My Book");
  });

  it("parses --wait flag", () => {
    const result = parseArgs(["https://example.com", "--wait", "2000"]);
    expect(result.wait).toBe(2000);
  });

  it("parses --delay flag", () => {
    const result = parseArgs(["https://example.com", "--delay", "1500"]);
    expect(result.delay).toBe(1500);
  });

  it("parses single --skip flag", () => {
    const result = parseArgs(["https://example.com", "--skip", "https://example.com/skip"]);
    expect(result.skipUrls).toEqual(["https://example.com/skip"]);
  });

  it("parses multiple --skip flags", () => {
    const result = parseArgs(["https://example.com", "--skip", "skip1", "--skip", "skip2"]);
    expect(result.skipUrls).toEqual(["skip1", "skip2"]);
  });

  it("parses --url-pattern flag", () => {
    const result = parseArgs(["https://example.com", "--url-pattern", "*/page*.html"]);
    expect(result.urlPattern).toBe("*/page*.html");
  });

  it("parses all flags together", () => {
    const result = parseArgs([
      "https://example.com/book",
      "--name",
      "Test Book",
      "--wait",
      "500",
      "--delay",
      "750",
      "--skip",
      "exclude",
      "--url-pattern",
      "**/*.html",
    ]);
    expect(result).toEqual({
      startUrl: "https://example.com/book",
      name: "Test Book",
      wait: 500,
      delay: 750,
      skipUrls: ["exclude"],
      urlPattern: "**/*.html",
      showHelp: false,
    });
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

describe("run", () => {
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
  });

  it("executes command with stdio inherit", () => {
    run("echo test", "Test step");

    expect(execSync).toHaveBeenCalledWith("echo test", { stdio: "inherit" });
  });

  it("logs step description with separator", () => {
    run("echo test", "Test step");

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("="));
    expect(mockConsoleLog).toHaveBeenCalledWith("Step: Test step");
  });

  it("returns step timing", () => {
    const result = run("echo test", "Test step");

    expect(result).toHaveProperty("step", "Test step");
    expect(result).toHaveProperty("duration");
    expect(typeof result.duration).toBe("number");
  });

  it("logs completion time", () => {
    run("echo test", "Test step");

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("Completed in"));
  });
});

describe("main", () => {
  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  it("exits with error when no start URL provided", async () => {
    const originalArgv = process.argv;
    process.argv = ["node", "index.ts"];

    mockExit.mockImplementation(() => {
      throw new Error("process.exit called");
    });

    const { main } = await import("./index.js");

    expect(() => main()).toThrow("process.exit called");

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
    expect(mockExit).toHaveBeenCalledWith(1);

    process.argv = originalArgv;
  });

  it("runs all pipeline steps", async () => {
    const originalArgv = process.argv;
    process.argv = ["node", "index.ts", "https://example.com/book", "--name", "Test"];

    vi.mocked(execSync).mockImplementation(() => Buffer.from(""));

    const { main } = await import("./index.js");
    await main();

    // Verify all three steps were called
    expect(execSync).toHaveBeenCalledTimes(3);
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining("scrape.ts"), expect.any(Object));
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining("merge.ts"), expect.any(Object));
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining("pdf.ts"), expect.any(Object));

    process.argv = originalArgv;
  });

  it("includes skip URLs in scrape command", async () => {
    const originalArgv = process.argv;
    process.argv = ["node", "index.ts", "https://example.com", "--skip", "skip1", "--skip", "skip2"];

    vi.mocked(execSync).mockImplementation(() => Buffer.from(""));

    const { main } = await import("./index.js");
    await main();

    const scrapeCall = vi.mocked(execSync).mock.calls[0][0] as string;
    expect(scrapeCall).toContain('--skip "skip1"');
    expect(scrapeCall).toContain('--skip "skip2"');

    process.argv = originalArgv;
  });

  it("includes url-pattern in scrape command", async () => {
    const originalArgv = process.argv;
    process.argv = ["node", "index.ts", "https://example.com", "--url-pattern", "*/page*.html"];

    vi.mocked(execSync).mockImplementation(() => Buffer.from(""));

    const { main } = await import("./index.js");
    await main();

    const scrapeCall = vi.mocked(execSync).mock.calls[0][0] as string;
    expect(scrapeCall).toContain('--url-pattern "*/page*.html"');

    process.argv = originalArgv;
  });

  it("exits with error when pipeline step fails", async () => {
    const originalArgv = process.argv;
    process.argv = ["node", "index.ts", "https://example.com/book"];

    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("Command failed");
    });
    mockExit.mockImplementation(() => {
      throw new Error("process.exit called");
    });

    const { main } = await import("./index.js");

    expect(() => main()).toThrow("process.exit called");

    expect(mockConsoleError).toHaveBeenCalledWith("\nError:", expect.any(Error));
    expect(mockExit).toHaveBeenCalledWith(1);

    process.argv = originalArgv;
  });

  it("logs pipeline completion message", async () => {
    const originalArgv = process.argv;
    process.argv = ["node", "index.ts", "https://example.com/book"];

    vi.mocked(execSync).mockImplementation(() => Buffer.from(""));

    const { main } = await import("./index.js");
    await main();

    expect(mockConsoleLog).toHaveBeenCalledWith("Pipeline complete!");

    process.argv = originalArgv;
  });

  it("displays timing summary", async () => {
    const originalArgv = process.argv;
    process.argv = ["node", "index.ts", "https://example.com/book"];

    vi.mocked(execSync).mockImplementation(() => Buffer.from(""));

    const { main } = await import("./index.js");
    await main();

    expect(mockConsoleLog).toHaveBeenCalledWith("\nTiming Summary:");
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("Total"));

    process.argv = originalArgv;
  });

  it("shows help and exits with code 0 when --help flag is provided", async () => {
    const originalArgv = process.argv;
    process.argv = ["node", "index.ts", "--help"];

    mockExit.mockImplementation(() => {
      throw new Error("process.exit called");
    });

    const { main } = await import("./index.js");

    expect(() => main()).toThrow("process.exit called");

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
    expect(mockExit).toHaveBeenCalledWith(0);

    process.argv = originalArgv;
  });
});
