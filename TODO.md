# TODO

Project roadmap and planned improvements.

## High Priority

- [ ] **Increase test coverage to 90%+** - Current coverage is limited to utility functions; add tests for merge.ts, argument parsing, etc.

### merge.ts Coverage Plan (94% achieved)

1. [x] Export testable pure functions (parseArgs, fixImagePaths, generateTocEntry)
2. [x] Mock fs/promises module in tests
3. [x] Test main() success path: reads meta.json, reads chapters, writes book.md
4. [x] Test main() error: meta.json not found
5. [x] Test main() error: no chapters in metadata
6. [x] Test main() warning: missing chapter file (skipped gracefully)
7. [x] Verify TOC generation uses correct anchors
8. [x] Verify image paths are fixed in output

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
- [x] Fix broken TOC links in PDF (trailing spaces/punctuation in titles)
- [x] Add tests for TOC link generation (generateAnchor)
