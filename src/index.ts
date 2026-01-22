/**
 * Run full pipeline: scrape → merge → pdf
 *
 * Usage: npm run all -- <start-url>
 */

import { execSync } from 'child_process';

function run(command: string, description: string) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Step: ${description}`);
  console.log('='.repeat(50));
  execSync(command, { stdio: 'inherit' });
}

async function main() {
  const startUrl = process.argv[2];

  if (!startUrl) {
    console.error('Usage: npm run all -- <start-url>');
    console.error('Example: npm run all -- https://sportlabmipt.ru/sportsphysyologybook');
    process.exit(1);
  }

  console.log('Starting full pipeline...');
  console.log(`URL: ${startUrl}`);

  try {
    // Step 1: Scrape
    run(`npx tsx src/scrape.ts "${startUrl}"`, 'Scraping chapters');

    // Step 2: Merge
    run('npx tsx src/merge.ts', 'Merging chapters');

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

main();
