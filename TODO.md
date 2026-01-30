# TODO

Project roadmap and planned improvements.

## High Priority

<!-- COVERAGE-START -->
- [ ] **Increase test coverage to 90%+** - Overall: 85%

| File | Coverage | Status |
|------|----------|--------|
| index.ts | 97% | :green_circle: |
| merge.ts | 94% | :green_circle: |
| pdf.ts | 90% | :green_circle: |
| utils.ts | 89% | :yellow_circle: |
| scrape.ts | 57% | :red_circle: |
<!-- COVERAGE-END -->

- [ ] **Code quality improvements** - Ensure all code follows best practices

| Task | Status |
|------|--------|
| Add JSDoc to all exported functions in utils.ts | :green_circle: |
| Add JSDoc to all exported functions in merge.ts | :green_circle: |
| Add JSDoc to all exported functions in scrape.ts | :green_circle: |
| Add JSDoc to all exported functions in pdf.ts | :green_circle: |
| Add JSDoc to all exported functions in index.ts | :green_circle: |
| Review and improve function/variable naming | :green_circle: |
| Add inline comments for complex logic | :green_circle: |

## Medium Priority
- [ ] **Add cover page support** - Option to include a cover image and styled title page in the PDF
- [ ] **Improve chapter detection** - Better heuristics for distinguishing TOC pages from chapter pages (not just link count)

## Low Priority / Nice to Have

- [ ] **Add `--output` flag** - Allow specifying custom output directory
- [ ] **Add `--format` flag** - Support output formats other than PDF (epub, html)
- [ ] **Parallel image downloading** - Speed up scraping by downloading images concurrently with configurable concurrency limit
- [ ] **Resume interrupted scrapes** - Save progress and allow resuming if scraping is interrupted
- [ ] **Better error messages** - More helpful error messages when pages fail to load or content extraction fails

## Needs Improvement

Technical debt and code quality issues identified during code review.

### Architecture & Design

- [ ] **Mixed concerns in scrape.ts** - Single file handles CLI parsing, browser lifecycle, DOM extraction, image processing, and file I/O. Consider splitting into smaller modules.

### Input Validation & Security

- [ ] **No rate limiting / backoff** - No exponential backoff for failed requests. Could hammer servers on transient failures.

### Testing

- [ ] **No integration tests** - All tests use mocks. Add integration test with sample HTML fixtures to verify actual file generation.

### Developer Experience

- [ ] **No configuration file support** - All options must be passed via CLI. Support optional `.tildascraperrc.json` for repeated use.
- [ ] **No dry-run mode** - Can't preview what would be scraped without actually scraping.

### Documentation

- [ ] **No troubleshooting guide** - Missing docs for common issues: "no content found", "images not downloading", platform-specific problems.
- [ ] **No programmatic usage docs** - README only shows CLI usage. No examples for importing and using functions directly.

## Completed

- [x] Create shared `types.ts` for `ChapterMeta` and `BookMeta` type definitions
- [x] Add `--help` flag support to all CLI commands
- [x] Standardize error message format to use "Error:" prefix
- [x] Add tests for image download/save functions and PDF exception handling
- [x] Add graceful Ctrl+C handling with clean exit message
- [x] Add elapsed time display for pipeline steps
- [x] Deduplicate content blocks during chapter extraction
- [x] Add `--skip` option to exclude specific URLs
- [x] Add `--url-pattern` option to filter URLs by glob pattern
- [x] Fix deduplication to preserve images
- [x] Add unit tests with vitest
- [x] Fix broken TOC links in PDF (trailing spaces/punctuation in titles)
- [x] Add tests for TOC link generation (generateAnchor)
- [x] Track and summarize failed image downloads
- [x] Continue scraping after chapter failures with summary report
- [x] Add error details to PDF generation failures
- [x] Fix process.argv restoration in tests
- [x] Add edge case tests (empty pages, unicode titles, long title truncation)
- [x] Extract magic numbers to named constants (`TILDA_SKIP_BLOCK_TYPES`)
- [x] Extract hardcoded values to constants (`DEFAULT_USER_AGENT`, `TOC_LINK_THRESHOLD`)
- [x] Enable stricter TypeScript options (`noUnusedLocals`, `noUnusedParameters`, `forceConsistentCasingInFileNames`)
- [x] Add URL validation before `page.goto()` in scrape.ts
- [x] Add meta.json schema validation in merge.ts
- [x] Extract shared argument parsing utilities to utils.ts
- [x] Replace global imageCounter with parameter injection (`ImageStats`)
- [x] Add Biome linter for consistent code style and catching issues
- [x] Add pre-commit hooks with husky/lint-staged
- [x] Add GitHub Actions CI to run tests and linting on PRs
- [x] Increase Biome linter strictness to industry-standard (noExplicitAny as error, stricter rules)
- [x] Fix unsafe URL concatenation in scrape.ts - use `new URL(href, baseUrl)` instead of string concat
