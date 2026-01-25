# TODO

Project roadmap and planned improvements.

## High Priority

- [ ] **Fix broken TOC links in PDF** - Chapters 2, 4, 19, 24, 34, 49, 51, 59 have broken links from table of contents (trailing spaces/punctuation in titles cause anchor mismatch)
- [ ] **Add tests for TOC link generation** - Prevent broken links regression by testing that generated anchors match chapter headings
- [ ] **Increase test coverage to 90%+** - Current coverage is limited to utility functions; add tests for merge.ts, argument parsing, etc.

## Medium Priority

- [ ] **Add elapsed time display** - Show timing for each pipeline step (scrape, merge, pdf) and total elapsed time in a summary table
- [ ] **Add cover page support** - Option to include a cover image and styled title page in the PDF
- [ ] **Improve chapter detection** - Better heuristics for distinguishing TOC pages from chapter pages (not just link count)

## Low Priority / Nice to Have

- [ ] **Add `--output` flag** - Allow specifying custom output directory
- [ ] **Add `--format` flag** - Support output formats other than PDF (epub, html)
- [ ] **Parallel image downloading** - Speed up scraping by downloading images concurrently with configurable concurrency limit
- [ ] **Resume interrupted scrapes** - Save progress and allow resuming if scraping is interrupted
- [ ] **Better error messages** - More helpful error messages when pages fail to load or content extraction fails

## Completed

- [x] Deduplicate content blocks during chapter extraction
- [x] Add `--skip` option to exclude specific URLs
- [x] Add `--url-pattern` option to filter URLs by glob pattern
- [x] Fix deduplication to preserve images
- [x] Add unit tests with vitest
