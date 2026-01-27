# TODO

Project roadmap and planned improvements.

## High Priority

- [ ] **Increase test coverage to 90%+** - Overall: 67%

| File | Coverage | Status |
|------|----------|--------|
| index.ts | 98% | :green_circle: |
| utils.ts | 73% | :yellow_circle: (signal handlers hard to test) |
| merge.ts | 92% | :green_circle: |
| pdf.ts | 85% | :green_circle: |
| scrape.ts | 51% | :yellow_circle: (browser-context code limits this) |

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

## Needs Improvement

Technical debt and code quality issues identified during code review.

### Architecture & Design

- [ ] **Global mutable state** (`scrape.ts:29`) - `imageCounter` is module-level mutable state. Causes potential race conditions with parallel downloads and test isolation issues. Use parameter injection or UUIDs instead.
- [ ] **Duplicate argument parsing** (`scrape.ts`, `index.ts`) - Both files implement similar `parseArgs()` functions. Extract to shared utility.
- [ ] **Mixed concerns in scrape.ts** - Single file handles CLI parsing, browser lifecycle, DOM extraction, image processing, and file I/O. Consider splitting into smaller modules.

### Input Validation & Security

- [ ] **No URL validation** (`scrape.ts:421`) - Start URL passed directly to `page.goto()` without format validation. Use `URL()` constructor to validate.
- [ ] **Unsafe URL concatenation** (`scrape.ts:289-293`) - Manual string concatenation for URL joining. Use `new URL(href, baseUrl)` instead.
- [ ] **No meta.json schema validation** (`merge.ts:100`) - Parses JSON without validating structure. Could fail silently with malformed data.
- [ ] **No rate limiting / backoff** - No exponential backoff for failed requests. Could hammer servers on transient failures.

### Testing

- [ ] **No integration tests** - All tests use mocks. Add integration test with sample HTML fixtures to verify actual file generation.

### Code Style & Consistency

- [ ] **Inconsistent error message format** - Some errors start with "Error:", some with "Usage:", some lowercase. Standardize format.

### Developer Experience

- [ ] **No configuration file support** - All options must be passed via CLI. Support optional `.tildascraperrc.json` for repeated use.
- [ ] **No dry-run mode** - Can't preview what would be scraped without actually scraping.
- [ ] **Build doesn't run tests** (`package.json`) - `npm run build` only runs `tsc`. Should run tests first.

### Tooling & Configuration

- [ ] **No linting** - Missing ESLint/Biome configuration for consistent code style and catching issues.
- [ ] **No pre-commit hooks** - No husky/lint-staged to enforce tests and linting before commits.
- [ ] **No CI/CD** - No GitHub Actions to run tests on PRs.
- [ ] **TypeScript could be stricter** - Missing `noUnusedLocals`, `noUnusedParameters`, `forceConsistentCasingInFileNames`.

### Documentation

- [ ] **No troubleshooting guide** - Missing docs for common issues: "no content found", "images not downloading", platform-specific problems.
- [ ] **No programmatic usage docs** - README only shows CLI usage. No examples for importing and using functions directly.

## Completed

- [x] Create shared `types.ts` for `ChapterMeta` and `BookMeta` type definitions
- [x] Add `--help` flag support to all CLI commands
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
