# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

Scrape book content from sportlabmipt.ru (a Tilda-based site), convert chapters to markdown, merge them, and generate a PDF. Built to automate manual copy-pasting of book text.

## Commands

```bash
npm install          # Install dependencies
npm run scrape       # Scrape chapters to output/chapters/*.md
npm run merge        # Merge chapters into output/book.md
npm run pdf          # Convert to output/book.pdf
npm run all          # Run full pipeline
```

## Architecture

```
src/
  scrape.ts   # Puppeteer scraper → markdown via Turndown
  merge.ts    # Concatenate chapter files in order
  pdf.ts      # md-to-pdf conversion
  index.ts    # Full pipeline orchestration

output/       # Generated files (gitignored)
  chapters/   # Individual chapter markdown files
  meta.json   # Chapter order and metadata
  book.md     # Merged document
  book.pdf    # Final output
```

## Tech Stack

- **Puppeteer** - Required because site uses JS rendering (Tilda platform)
- **Turndown** - HTML to Markdown conversion
- **md-to-pdf** - Markdown to styled PDF

## Site-Specific Notes

- sportlabmipt.ru is built on Tilda; content lives in `t-records` containers
- Has bot detection via user-agent check - use realistic browser UA
- URL patterns are inconsistent: some use slugs (`/biongr001`), others use IDs (`/page89044496.html`)
- Add delays between requests to avoid rate limiting
