import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPage, DEFAULT_USER_AGENT, DEFAULT_VIEWPORT, launchBrowser } from "./browser.js";

// Mock puppeteer
vi.mock("puppeteer", () => ({
  default: {
    launch: vi.fn(),
  },
}));

import puppeteer from "puppeteer";

describe("browser constants", () => {
  it("has realistic Chrome user agent", () => {
    expect(DEFAULT_USER_AGENT).toContain("Chrome");
    expect(DEFAULT_USER_AGENT).toContain("Mozilla");
    expect(DEFAULT_USER_AGENT).toContain("AppleWebKit");
  });

  it("has reasonable viewport dimensions", () => {
    expect(DEFAULT_VIEWPORT.width).toBeGreaterThan(0);
    expect(DEFAULT_VIEWPORT.height).toBeGreaterThan(0);
    expect(DEFAULT_VIEWPORT.width).toBe(1280);
    expect(DEFAULT_VIEWPORT.height).toBe(800);
  });
});

describe("launchBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("launches headless browser with security args", async () => {
    const mockBrowser = { close: vi.fn() };
    vi.mocked(puppeteer.launch).mockResolvedValueOnce(
      mockBrowser as unknown as Awaited<ReturnType<typeof puppeteer.launch>>,
    );

    const browser = await launchBrowser();

    expect(puppeteer.launch).toHaveBeenCalledWith({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    expect(browser).toBe(mockBrowser);
  });
});

describe("createPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates page with user agent and viewport", async () => {
    const mockPage = {
      setUserAgent: vi.fn().mockResolvedValue(undefined),
      setViewport: vi.fn().mockResolvedValue(undefined),
    };
    const mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
    };

    const page = await createPage(mockBrowser as unknown as Awaited<ReturnType<typeof puppeteer.launch>>);

    expect(mockBrowser.newPage).toHaveBeenCalled();
    expect(mockPage.setUserAgent).toHaveBeenCalledWith(DEFAULT_USER_AGENT);
    expect(mockPage.setViewport).toHaveBeenCalledWith(DEFAULT_VIEWPORT);
    expect(page).toBe(mockPage);
  });
});
