#!/bin/bash
# Update test coverage and publish results
# - Runs tests with coverage
# - Updates TODO.md coverage section (between markers)
# - Generates detailed coverage report for internal use

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COVERAGE_DIR="$PROJECT_ROOT/coverage"
DETAILED_COVERAGE="$PROJECT_ROOT/.coverage-details.json"
TODO_FILE="$PROJECT_ROOT/TODO.md"

cd "$PROJECT_ROOT"

# Run tests with coverage (suppress output)
npm test -- --coverage \
  --coverage.reporter=json-summary \
  --coverage.reporter=json \
  --coverage.reportsDirectory=coverage \
  > /dev/null 2>&1

# Check if coverage files exist
if [[ ! -f "$COVERAGE_DIR/coverage-summary.json" ]]; then
  echo "Error: coverage-summary.json not found" >&2
  exit 1
fi

# Create detailed coverage file with both summary and per-file details
node -e "
const fs = require('fs');
const summary = JSON.parse(fs.readFileSync('$COVERAGE_DIR/coverage-summary.json', 'utf-8'));
const detailed = JSON.parse(fs.readFileSync('$COVERAGE_DIR/coverage-final.json', 'utf-8'));

// Extract src/ files only (skip dist/ and test files)
const srcFiles = {};
for (const [filePath, data] of Object.entries(detailed)) {
  if (filePath.includes('/src/') && !filePath.includes('.test.')) {
    const fileName = filePath.split('/').pop();
    srcFiles[fileName] = {
      path: filePath,
      // Uncovered lines (deduplicated and sorted)
      uncoveredLines: data.statementMap ? [...new Set(
        Object.keys(data.statementMap)
          .filter(key => data.s[key] === 0)
          .map(key => data.statementMap[key].start.line)
      )].sort((a, b) => a - b) : [],
      // Functions with coverage info
      functions: data.fnMap ? Object.keys(data.fnMap).map(key => ({
        name: data.fnMap[key].name,
        line: data.fnMap[key].decl.start.line,
        hits: data.f[key] || 0
      })) : []
    };
  }
}

// Build output with summary and details
const output = {
  generatedAt: new Date().toISOString(),
  summary: {
    total: summary.total,
    files: {}
  },
  details: srcFiles
};

// Add per-file summary for src files
for (const [filePath, data] of Object.entries(summary)) {
  if (filePath.includes('/src/') && !filePath.includes('.test.')) {
    const fileName = filePath.split('/').pop();
    output.summary.files[fileName] = {
      lines: data.lines.pct,
      statements: data.statements.pct,
      functions: data.functions.pct,
      branches: data.branches.pct
    };
  }
}

fs.writeFileSync('$DETAILED_COVERAGE', JSON.stringify(output, null, 2));
"

# Generate and replace coverage section between markers
node -e "
const fs = require('fs');
const coverage = JSON.parse(fs.readFileSync('$DETAILED_COVERAGE', 'utf-8'));
const todo = fs.readFileSync('$TODO_FILE', 'utf-8');

// Check for markers
if (!todo.includes('<!-- COVERAGE-START -->') || !todo.includes('<!-- COVERAGE-END -->')) {
  console.error('Error: TODO.md missing coverage markers');
  console.error('Add <!-- COVERAGE-START --> and <!-- COVERAGE-END --> markers');
  process.exit(1);
}

const files = coverage.summary.files;
const fileNames = Object.keys(files);

// Calculate overall coverage (average of src files by lines)
const overall = Math.round(
  fileNames.reduce((sum, f) => sum + files[f].lines, 0) / fileNames.length
);

// Determine status circle based on coverage
// >= 90%: green, >= 70%: yellow, < 70%: red
function getStatus(pct) {
  if (pct >= 90) return ':green_circle:';
  if (pct >= 70) return ':yellow_circle:';
  return ':red_circle:';
}

// Build coverage section
const lines = [
  '<!-- COVERAGE-START -->',
  '- [ ] **Increase test coverage to 90%+** - Overall: ' + overall + '%',
  '',
  '| File | Coverage | Status |',
  '|------|----------|--------|'
];

// Sort files: highest coverage first
const sortedFiles = fileNames.sort((a, b) => files[b].lines - files[a].lines);

for (const fileName of sortedFiles) {
  const pct = Math.round(files[fileName].lines);
  const status = getStatus(pct);
  lines.push('| ' + fileName + ' | ' + pct + '% | ' + status + ' |');
}

lines.push('<!-- COVERAGE-END -->');

// Replace content between markers
const markerPattern = /<!-- COVERAGE-START -->[\s\S]*?<!-- COVERAGE-END -->/;
const updated = todo.replace(markerPattern, lines.join('\n'));

fs.writeFileSync('$TODO_FILE', updated);
"

echo "Done"
