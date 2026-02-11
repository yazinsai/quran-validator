/**
 * Re-run fabrication analysis on cached benchmark results using the latest quran-validator.
 * Does NOT change validation status - only updates fabricationAnalysis for each quote.
 *
 * Run with: npx tsx scripts/revalidate-cache.ts
 */

import fs from 'fs';
import path from 'path';
import { QuranValidator } from 'quran-validator';

const CACHE_FILE = path.join(__dirname, '../cache.json');

async function main() {
  const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
  const cache = JSON.parse(raw);
  const results = cache.results;
  const modelIds = Object.keys(results);
  const validator = new QuranValidator();

  console.log(`Re-running fabrication analysis for ${modelIds.length} models...`);

  let totalChanges = 0;

  for (const modelId of modelIds) {
    const entry = results[modelId];
    let modelChanges = 0;

    // Update fabrication analysis for all quotes (top-level and in promptResults)
    const allQuotes = entry.quotes || [];
    for (const quote of allQuotes) {
      if (!quote.original || quote.isValid) continue;

      const oldFabWords = quote.fabricationAnalysis?.stats?.fabricatedWords ?? -1;
      const newAnalysis = validator.analyzeFabrication(quote.original);
      quote.fabricationAnalysis = newAnalysis;

      if (oldFabWords !== newAnalysis.stats.fabricatedWords) {
        modelChanges++;
        if (oldFabWords >= 0) {
          console.log(`  ${entry.modelName || modelId} [${quote.reference}]: fabricated words ${oldFabWords} → ${newAnalysis.stats.fabricatedWords}`);
        }
      }
    }

    // Also update promptResults quotes (which are the source of truth)
    if (entry.promptResults) {
      for (const pr of entry.promptResults) {
        if (!pr.quotes) continue;
        for (const quote of pr.quotes) {
          if (!quote.original || quote.isValid) continue;

          const oldFabWords = quote.fabricationAnalysis?.stats?.fabricatedWords ?? -1;
          const newAnalysis = validator.analyzeFabrication(quote.original);
          quote.fabricationAnalysis = newAnalysis;

          if (oldFabWords !== newAnalysis.stats.fabricatedWords && oldFabWords >= 0) {
            // Already logged above from the top-level quotes
          }
        }
      }
    }

    // Rebuild error breakdown
    const errorBreakdown: Record<string, number> = {};
    for (const quote of allQuotes) {
      if (quote.invalidReason) {
        errorBreakdown[quote.invalidReason] = (errorBreakdown[quote.invalidReason] || 0) + 1;
      }
    }
    if (entry.promptResults) {
      const noArabicPrompts = entry.promptResults.filter((r: any) => r.noArabicContent).length;
      if (noArabicPrompts > 0) {
        errorBreakdown['no_arabic_content'] = noArabicPrompts;
      }
    }
    entry.errorBreakdown = errorBreakdown;

    if (modelChanges > 0) {
      totalChanges += modelChanges;
    }
  }

  // Write back
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  console.log(`\nDone. ${totalChanges} fabrication analysis updates across ${modelIds.length} models.`);
}

main().catch(console.error);
