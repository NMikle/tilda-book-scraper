# tilda-book-scraper

Scrape book content from Tilda-based websites, convert chapters to markdown with images, and generate a styled PDF.

## Features

- Scrapes chapter content from Tilda-based sites (JS-rendered pages)
- Automatically follows "Next" navigation or scrapes from table of contents
- Downloads and processes images (converts to JPEG, handles transparency)
- Converts HTML to clean Markdown
- Merges chapters into a single document with table of contents
- Generates styled PDF with custom typography

## Requirements

- Node.js 18+
- npm

## Installation

```bash
git clone https://github.com/nmikle/tilda-book-scraper.git
cd tilda-book-scraper
npm install
```

## Usage

### Full Pipeline

Run scraping, merging, and PDF generation in one command:

```bash
npm run all -- <url> [options]
```

**Options:**
- `--name "title"` - Book title for PDF cover (default: "Book")
- `--wait ms` - Page render wait time in milliseconds (default: 1000)
- `--delay ms` - Delay between chapters in milliseconds (default: 1000)
- `--skip <url>` - Skip specific URL (can be used multiple times, scrape only)
- `--url-pattern <glob>` - Only include URLs matching glob pattern (scrape only)

**Examples:**

```bash
npm run all -- https://example.com/book --name "My Book"
npm run all -- https://example.com/book --name "My Book" --wait 2000 --delay 1500
npm run all -- https://example.com/book --skip https://example.com/unrelated
npm run all -- https://example.com/book --url-pattern "*/page*.html"
```

### Individual Steps

```bash
# Step 1: Scrape chapters to markdown
npm run scrape -- <url> [options]

# Step 2: Merge chapters into single document
npm run merge [-- --name "Book Title"]

# Step 3: Generate PDF
npm run pdf
```

## Output

All output is saved to the `output/` directory:

```
output/
  chapters/    # Individual chapter markdown files
  images/      # Downloaded images (converted to JPEG)
  meta.json    # Chapter metadata (order, titles, URLs)
  book.md      # Merged document with table of contents
  book.pdf     # Final styled PDF
```

## How It Works

1. **Scraping**: Uses Puppeteer to load pages (required for JS-rendered Tilda sites). Extracts content from Tilda's `[data-record-type]` containers, downloads images from Tilda CDN.

2. **Detection**: Automatically detects if the start URL is a table of contents (many links) or a chapter page (follows "Next" links).

3. **Image Processing**: Transforms Tilda placeholder URLs to actual image URLs, converts all images to JPEG with white background (handles transparency issues in PDFs).

4. **Conversion**: Uses Turndown to convert HTML to Markdown, then md-to-pdf for the final PDF with custom styling.

## Limitations

- Designed specifically for Tilda-based websites
- Relies on Tilda's DOM structure (`t-text`, `t-title`, `data-record-type`, etc.)
- May need adjustments for sites with different Tilda templates

## Roadmap

See [TODO.md](TODO.md) for planned features and improvements.

## License

MIT
