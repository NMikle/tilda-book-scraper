/**
 * Convert merged markdown to PDF
 *
 * Usage: npm run pdf
 */

import { mdToPdf } from 'md-to-pdf';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OUTPUT_DIR = 'output';
const INPUT_FILE = path.join(OUTPUT_DIR, 'book.md');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'book.pdf');
const STYLES_FILE = path.join(__dirname, 'styles.css');

export async function main() {
  // Check if book.md exists
  try {
    await fs.access(INPUT_FILE);
  } catch {
    console.error(`Error: ${INPUT_FILE} not found. Run 'npm run merge' first.`);
    process.exit(1);
  }

  console.log(`Converting ${INPUT_FILE} to PDF...`);

  const pdf = await mdToPdf(
    { path: INPUT_FILE },
    {
      dest: OUTPUT_FILE,
      pdf_options: {
        format: 'A4',
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm',
        },
        printBackground: true,
      },
      stylesheet: [STYLES_FILE],
    }
  );

  if (pdf.filename) {
    const stats = await fs.stat(OUTPUT_FILE);
    const sizeMb = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`PDF saved to: ${OUTPUT_FILE} (${sizeMb} MB)`);
  } else {
    console.error('Error: PDF generation failed.');
    process.exit(1);
  }
}

// Only run main when executed directly (not when imported for testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}
