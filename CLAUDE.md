# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

Scrape book content from sportlabmipt.ru (a Tilda-based site), convert chapters to markdown with images, merge them, and generate a PDF. Built to automate manual copy-pasting of book text.

## Commands

```bash
npm install                                        # Install dependencies
npm run scrape -- <url> [options]                  # Scrape chapters to output/chapters/*.md
npm run merge [-- --name "title"]                  # Merge chapters into output/book.md
npm run pdf                                        # Convert to output/book.pdf
npm run all -- <url> [options]                     # Run full pipeline
```

**Options:**
- `--name "title"` - Book title for PDF cover (default: "Book")
- `--wait ms` - Page render wait time in milliseconds (default: 1000)
- `--delay ms` - Delay between chapters in milliseconds (default: 1000)

**Examples:**
```bash
npm run all -- https://sportlabmipt.ru/sportsphysyologybook --name "Физиология спорта"
npm run all -- https://sportlabmipt.ru/biongr001 --name "БИОМЕХАНИКА" --wait 2000 --delay 1500
npm run scrape -- https://sportlabmipt.ru/biongr001 --wait 500 --delay 500
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
3. For chapter pages: follows "Следующая →" (Next) links automatically
4. Extracts content from Tilda text blocks (`t-text`, `t-title`, etc.)
5. Downloads images, transforms placeholder URLs, converts to JPEG
6. Converts HTML to Markdown, saves each chapter separately
7. Writes metadata JSON with chapter order for merge step

## Site-Specific Notes

- sportlabmipt.ru is built on Tilda; content lives in `[data-record-type]` containers
- Has bot detection via user-agent check - scraper uses realistic Chrome UA
- URL patterns are inconsistent: slugs (`/biongr001`) and IDs (`/page89044496.html`)
- Configurable delays between requests (default 1s, adjustable via --delay)
- Russian text uses UTF-8 encoding

### Tilda Image CDN

Tilda uses placeholder images that must be transformed to get actual content:
- `thb.tildacdn.com/tildXXXX/-/empty/image.png` → placeholder (blank)
- `static.tildacdn.com/tildXXXX/image.png` → actual image

The scraper automatically transforms these URLs. Images are converted to JPEG with white background (handles transparency issues in PDFs).
