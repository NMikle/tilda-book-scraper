/**
 * Convert merged markdown to PDF
 *
 * Usage: npm run pdf
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { mdToPdf } from "md-to-pdf";
import { hasHelpFlag, setupSignalHandlers } from "./utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OUTPUT_DIR = "output";
const INPUT_FILE = path.join(OUTPUT_DIR, "book.md");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "book.pdf");
const STYLES_FILE = path.join(__dirname, "styles.css");

/**
 * Print usage information for the pdf command.
 */
function showUsage(): void {
  console.log("Usage: npm run pdf");
  console.log("");
  console.log("Convert merged markdown (book.md) to PDF.");
  console.log("");
  console.log("Options:");
  console.log("  --help, -h           Show this help message");
  console.log("");
  console.log('Requires: output/book.md (run "npm run merge" first)');
}

/**
 * Parse command line arguments for the pdf command.
 *
 * @param args - Command line arguments (defaults to process.argv)
 * @returns Parsed options with help flag
 */
export function parseArgs(args: string[] = process.argv.slice(2)): { showHelp: boolean } {
  return { showHelp: hasHelpFlag(args) };
}

/**
 * Main entry point for PDF generation.
 * Converts book.md to book.pdf using md-to-pdf with custom styling.
 *
 * @throws Exits with code 1 if book.md is missing or PDF generation fails
 */
export async function main(): Promise<void> {
  const { showHelp } = parseArgs();

  if (showHelp) {
    showUsage();
    process.exit(0);
  }

  // Check if book.md exists
  try {
    await fs.access(INPUT_FILE);
  } catch {
    console.error(`Error: ${INPUT_FILE} not found. Run 'npm run merge' first.`);
    process.exit(1);
  }

  console.log(`Converting ${INPUT_FILE} to PDF...`);

  let pdf: { filename?: string } | undefined;
  try {
    pdf = await mdToPdf(
      { path: INPUT_FILE },
      {
        dest: OUTPUT_FILE,
        pdf_options: {
          format: "A4",
          margin: {
            top: "20mm",
            right: "20mm",
            bottom: "20mm",
            left: "20mm",
          },
          printBackground: true,
        },
        stylesheet: [STYLES_FILE],
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: PDF generation failed - ${message}`);
    process.exit(1);
  }

  if (pdf.filename) {
    const stats = await fs.stat(OUTPUT_FILE);
    const sizeMb = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`PDF saved to: ${OUTPUT_FILE} (${sizeMb} MB)`);
  } else {
    console.error("Error: PDF generation failed - no output file was created.");
    process.exit(1);
  }
}

// Only run main when executed directly (not when imported for testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  setupSignalHandlers("PDF generation");
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}
