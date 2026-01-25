/**
 * Run full pipeline: scrape → merge → pdf
 *
 * Usage: npm run all -- <start-url> [options]
 */

import { execSync } from 'child_process';

export interface PipelineOptions {
  startUrl: string;
  name: string;
  wait: number;
  delay: number;
  skipUrls: string[];
  urlPattern: string | null;
}

/**
 * Parse command line arguments from an array
 * Exported for testing
 */
export function parseArgs(args: string[] = process.argv.slice(2)): PipelineOptions {
  let startUrl = '';
  let name = 'Book';
  let wait = 1000;
  let delay = 1000;
  const skipUrls: string[] = [];
  let urlPattern: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      name = args[i + 1];
      i++;
    } else if (args[i] === '--wait' && args[i + 1]) {
      wait = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--delay' && args[i + 1]) {
      delay = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip' && args[i + 1]) {
      skipUrls.push(args[i + 1]);
      i++;
    } else if (args[i] === '--url-pattern' && args[i + 1]) {
      urlPattern = args[i + 1];
      i++;
    } else if (!args[i].startsWith('--')) {
      startUrl = args[i];
    }
  }

  return { startUrl, name, wait, delay, skipUrls, urlPattern };
}

/**
 * Run a shell command with description header
 * Exported for testing
 */
export function run(command: string, description: string) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Step: ${description}`);
  console.log('='.repeat(50));
  execSync(command, { stdio: 'inherit' });
}

export async function main() {
  const { startUrl, name, wait, delay, skipUrls, urlPattern } = parseArgs();

  if (!startUrl) {
    console.error('Usage: npm run all -- <start-url> [options]');
    console.error('Example: npm run all -- https://example.com/book --name "My Book"');
    console.error('Options:');
    console.error('  --name "title"       Book title (default: "Book")');
    console.error('  --wait ms            Page render wait time (default: 1000)');
    console.error('  --delay ms           Delay between chapters (default: 1000)');
    console.error('  --skip <url>         Skip specific URL (can be used multiple times)');
    console.error('  --url-pattern <p>    Only include URLs matching glob pattern');
    process.exit(1);
  }

  console.log('Starting full pipeline...');
  console.log(`URL: ${startUrl}`);
  console.log(`Book name: ${name}`);

  try {
    // Step 1: Scrape - build command with optional filters
    let scrapeCmd = `npx tsx src/scrape.ts "${startUrl}" --wait ${wait} --delay ${delay}`;
    for (const skip of skipUrls) {
      scrapeCmd += ` --skip "${skip}"`;
    }
    if (urlPattern) {
      scrapeCmd += ` --url-pattern "${urlPattern}"`;
    }
    run(scrapeCmd, 'Scraping chapters');

    // Step 2: Merge
    run(`npx tsx src/merge.ts --name "${name}"`, 'Merging chapters');

    // Step 3: Generate PDF
    run('npx tsx src/pdf.ts', 'Generating PDF');

    console.log('\n' + '='.repeat(50));
    console.log('Pipeline complete!');
    console.log('='.repeat(50));
    console.log('\nOutput files:');
    console.log('  - output/chapters/*.md  (individual chapters)');
    console.log('  - output/meta.json      (metadata)');
    console.log('  - output/book.md        (merged document)');
    console.log('  - output/book.pdf       (final PDF)');
  } catch (error) {
    console.error('\nPipeline failed:', error);
    process.exit(1);
  }
}

// Only run main when executed directly (not when imported for testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
