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

output/        # Generated files (gitignored)
  chapters/    # Individual chapter markdown files (001-title.md, 002-title.md, ...)
  images/      # Downloaded images converted to JPEG
  meta.json    # Chapter order, titles, URLs
  book.md      # Merged document with TOC
  book.pdf     # Final styled PDF
```

## Tech Stack

- **Puppeteer** - Required because site uses JS rendering (Tilda platform)
- **Turndown** - HTML to Markdown conversion
- **sharp** - Image processing (convert to JPEG, handle transparency)
- **md-to-pdf** - Markdown to styled PDF

## How the Scraper Works

1. Navigates to start URL with realistic Chrome user-agent
2. Detects if page is a TOC (>20 links) or a chapter page
3. For chapter pages: follows "Next" / "→" navigation links automatically
4. Extracts content from Tilda text blocks (`t-text`, `t-title`, etc.)
5. Downloads images, transforms placeholder URLs, converts to JPEG
6. Converts HTML to Markdown, saves each chapter separately
7. Writes metadata JSON with chapter order for merge step

## Tilda Platform Notes

- Tilda sites store content in `[data-record-type]` containers
- Some sites have bot detection via user-agent - scraper uses realistic Chrome UA
- URL patterns vary: slugs (`/book-title`) or IDs (`/page12345.html`)
- Configurable delays between requests (default 1s, adjustable via --delay)
- Supports UTF-8 encoding (works with non-Latin text)

### Tilda Image CDN

Tilda uses placeholder images that must be transformed to get actual content:
- `thb.tildacdn.com/tildXXXX/-/empty/image.png` → placeholder (blank)
- `static.tildacdn.com/tildXXXX/image.png` → actual image

The scraper automatically transforms these URLs. Images are converted to JPEG with white background (handles transparency issues in PDFs).

## Testing

- **Always run tests before committing** - Run `npm test` and ensure all tests pass before any commit
- **Strive for maximum coverage** - All new code should have corresponding tests; target full coverage
- **Use mocks for external dependencies** - Never test actual puppeteer, fs, or network calls; mock them instead
- **Never break existing functionality** - If tests fail, fix the issue before committing

## Code Style

### Documentation
- **All functions must have JSDoc comments** - Describe what the function does, its parameters, and return value
- **Export functions should always be documented** - Public API must be clear and well-documented
- **Complex logic needs inline comments** - Explain "why", not "what"

### Naming
- **Use descriptive names** - Variables and functions should be self-explanatory
- **Boolean variables start with is/has/should** - e.g., `isComplete`, `hasError`, `shouldRetry`
- **Functions start with verbs** - e.g., `parseArgs`, `downloadImage`, `generateAnchor`

### Structure
- **Keep functions small and focused** - Each function should do one thing well
- **Extract reusable logic to utils.ts** - Shared utilities should be centralized and tested
- **Group related code together** - Organize by feature/responsibility
- **Prefer early returns** - Reduce nesting by handling edge cases first

### TypeScript
- **Use explicit types for function signatures** - Parameters and return types should be typed
- **Export interfaces for shared types** - Make types reusable across modules
- **Avoid `any` type** - Use proper types or `unknown` if type is truly unknown
