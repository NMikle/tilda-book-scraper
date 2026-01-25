# TODO

Project roadmap and planned improvements.

## High Priority

- [ ] **Increase test coverage to 90%+** - Overall: 64%

| File | Coverage | Status |
|------|----------|--------|
| index.ts | 98% | :green_circle: |
| utils.ts | 97% | :green_circle: |
| merge.ts | 94% | :green_circle: |
| pdf.ts | 85% | :yellow_circle: |
| scrape.ts | 42% | :red_circle: (browser-context code limits this) |

- [ ] **Code quality improvements** - Ensure all code follows best practices

| Task | Status |
|------|--------|
| Add JSDoc to all exported functions in utils.ts | :green_circle: |
| Add JSDoc to all exported functions in merge.ts | :green_circle: |
| Add JSDoc to all exported functions in scrape.ts | :green_circle: |
| Add JSDoc to all exported functions in pdf.ts | :green_circle: |
| Add JSDoc to all exported functions in index.ts | :green_circle: |
| Review and improve function/variable naming | :red_circle: |
| Add inline comments for complex logic | :red_circle: |

## Medium Priority
- [ ] **Add cover page support** - Option to include a cover image and styled title page in the PDF
- [ ] **Improve chapter detection** - Better heuristics for distinguishing TOC pages from chapter pages (not just link count)

## Low Priority / Nice to Have

- [ ] **Add `--output` flag** - Allow specifying custom output directory
- [ ] **Add `--format` flag** - Support output formats other than PDF (epub, html)
- [ ] **Parallel image downloading** - Speed up scraping by downloading images concurrently with configurable concurrency limit
- [ ] **Resume interrupted scrapes** - Save progress and allow resuming if scraping is interrupted
- [ ] **Better error messages** - More helpful error messages when pages fail to load or content extraction fails

## Completed

- [x] Add elapsed time display for pipeline steps
- [x] Deduplicate content blocks during chapter extraction
- [x] Add `--skip` option to exclude specific URLs
- [x] Add `--url-pattern` option to filter URLs by glob pattern
- [x] Fix deduplication to preserve images
- [x] Add unit tests with vitest
- [x] Fix broken TOC links in PDF (trailing spaces/punctuation in titles)
- [x] Add tests for TOC link generation (generateAnchor)
