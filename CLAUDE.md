# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

Scrape book content from Tilda-based websites, convert chapters to markdown with images, merge them, and generate a PDF. Built to automate manual copy-pasting of book text.

## Commands

```bash
npm install                                        # Install dependencies
npm test                                           # Run unit tests
npm run scrape -- <url> [options]                  # Scrape chapters to output/chapters/*.md
npm run merge [-- --name "title"]                  # Merge chapters into output/book.md
npm run pdf                                        # Convert to output/book.pdf
npm run all -- <url> [options]                     # Run full pipeline
```

**Options:**
- `--name "title"` - Book title for PDF cover (default: "Book")
- `--wait ms` - Page render wait time in milliseconds (default: 1000)
- `--delay ms` - Delay between chapters in milliseconds (default: 1000)
- `--skip <url>` - Skip specific URL, can be used multiple times (scrape only)
- `--url-pattern <glob>` - Only include URLs matching glob pattern (scrape only)
- `--help, -h` - Show help message

**Examples:**
```bash
npm run all -- https://example.com/book --name "My Book"
npm run all -- https://example.com/another-book --name "Another Book" --wait 2000 --delay 1500
npm run scrape -- https://example.com/book --wait 500 --delay 500
npm run scrape -- https://example.com/book --skip https://example.com/unrelated-page
npm run scrape -- https://example.com/book --url-pattern "*/page*.html"
npm run merge -- --name "My Book Title"
```

## Architecture

```
src/
  scrape.ts    # Puppeteer scraper → markdown via Turndown, downloads images
  merge.ts     # Concatenate chapter files with TOC, fix image paths
  pdf.ts       # md-to-pdf conversion with custom styles
  index.ts     # Full pipeline orchestration
  styles.css   # PDF typography styles
  types.ts     # Shared type definitions (ChapterMeta, BookMeta)
  utils.ts     # Shared utility functions (extract here for reuse)

output/        # Generated files (gitignored)
  chapters/    # Individual chapter markdown files (001-title.md, 002-title.md, ...)
  images/      # Downloaded images converted to JPEG
  meta.json    # Chapter order, titles, URLs
  book.md      # Merged document with TOC
  book.pdf     # Final styled PDF
```

## Tech Stack

- **Puppeteer** - Required because Tilda sites use JS rendering
- **Turndown** - HTML to Markdown conversion
- **sharp** - Image processing (convert to JPEG, handle transparency)
- **md-to-pdf** - Markdown to styled PDF

## Before Modifying Code

1. **Read first** - Understand existing code before suggesting changes
2. **Check for tests** - Find related test files (`*.test.ts`)
3. **Match existing patterns** - Follow conventions already in the codebase
4. **Run tests after changes** - Verify nothing broke

## Testing

**CRITICAL: Never commit code that fails tests.**

- Run `npm test` before every commit
- If tests fail: fix the issue, do not commit broken code
- All new code must have corresponding tests
- Use mocks for external dependencies (puppeteer, fs, network) - never make real calls in tests
- **NEVER remove or delete tests** without explicit user confirmation and strong justification

**What to mock:**
```typescript
vi.mock('puppeteer', () => ({ default: { launch: vi.fn() } }));
vi.mock('fs/promises', () => ({ mkdir: vi.fn(), writeFile: vi.fn() }));
```

## Code Style

### Documentation
- All exported functions must have JSDoc comments
- Complex logic needs inline comments explaining "why", not "what"

```typescript
// Good: explains why
// Transform placeholder URLs - Tilda serves blank images from thb.tildacdn.com
const actualUrl = transformTildaImageUrl(url);

// Bad: restates the code
// Call the transform function
const actualUrl = transformTildaImageUrl(url);
```

### Naming
| Pattern | Good | Bad |
|---------|------|-----|
| Booleans | `isComplete`, `hasError`, `shouldRetry` | `complete`, `error`, `retry` |
| Functions | `parseArgs`, `downloadImage` | `args`, `image` |
| Constants | `DEFAULT_PAGE_WAIT`, `TOC_LINK_THRESHOLD` | `wait`, `threshold` |

### Structure
- Keep functions small and focused - one responsibility per function
- Extract reusable logic to `utils.ts`
- Prefer early returns to reduce nesting

```typescript
// Good: early return
if (!url) return null;
const result = await fetch(url);
return result;

// Bad: unnecessary nesting
if (url) {
  const result = await fetch(url);
  return result;
}
return null;
```

### TypeScript
- Use explicit types for function signatures
- Export interfaces for shared types
- Avoid `any` - use proper types or `unknown`

```typescript
// Good
function parseArgs(args: string[]): ScraperOptions { ... }

// Bad
function parseArgs(args): any { ... }
```

## How the Scraper Works

1. Navigates to start URL with realistic Chrome user-agent
2. Detects if page is a TOC (>20 links) or a chapter page
3. For chapter pages: follows "Next" / "→" navigation links automatically
4. Extracts content from Tilda text blocks (`t-text`, `t-title`, etc.)
5. Downloads images, transforms placeholder URLs, converts to JPEG
6. Converts HTML to Markdown, saves each chapter separately
7. Writes metadata JSON with chapter order for merge step

## Tilda Platform Notes

- Content stored in `[data-record-type]` containers
- Bot detection exists - scraper uses realistic Chrome user-agent to avoid blocks
- URL patterns vary: slugs (`/book-title`) or IDs (`/page12345.html`)
- Supports UTF-8 encoding (works with Cyrillic and other non-Latin text)

### Tilda Image CDN

Tilda uses placeholder images that must be transformed:
- `thb.tildacdn.com/tildXXXX/-/empty/image.png` → placeholder (blank)
- `static.tildacdn.com/tildXXXX/image.png` → actual image

The scraper automatically transforms these URLs. Images are converted to JPEG with white background (handles transparency issues in PDFs).
