/**
 * Comprehensive check of all fabrication results in the cache.
 * Lists all words flagged as "fabricated" to catch false positives.
 *
 * Run with: npx tsx scripts/check-fabrications.ts
 */

import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(__dirname, '../cache.json');
const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
const cache = JSON.parse(raw);
const results = cache.results;

interface FabOccurrence {
  model: string;
  ref: string;
  reason: string | null;
  context: string; // surrounding words
}

const allFabWords = new Map<string, FabOccurrence[]>();

for (const [modelId, entry] of Object.entries(results) as any[]) {
  const quotes = entry.quotes || [];
  for (const q of quotes) {
    if (!q.fabricationAnalysis) continue;
    const words = q.fabricationAnalysis.words;
    const fabIndices = words
      .map((w: any, i: number) => w.isFabricated ? i : -1)
      .filter((i: number) => i >= 0);

    for (const idx of fabIndices) {
      const word = words[idx].word;
      // Get surrounding words for context
      const start = Math.max(0, idx - 1);
      const end = Math.min(words.length, idx + 2);
      const context = words.slice(start, end).map((w: any) => w.word).join(' ');

      const list = allFabWords.get(word) || [];
      list.push({
        model: entry.modelName || modelId,
        ref: q.reference,
        reason: q.invalidReason,
        context,
      });
      allFabWords.set(word, list);
    }
  }
}

// Sort by frequency (most common first)
const sorted = [...allFabWords.entries()].sort((a, b) => b[1].length - a[1].length);

console.log(`=== ALL FABRICATED WORDS (${sorted.length} unique) ===\n`);

for (const [word, occurrences] of sorted) {
  console.log(`${word} (${occurrences.length}x)`);
  for (const o of occurrences.slice(0, 5)) {
    console.log(`  ${o.model} [${o.ref}] reason=${o.reason}`);
    console.log(`    context: ...${o.context}...`);
  }
  if (occurrences.length > 5) {
    console.log(`  ... and ${occurrences.length - 5} more`);
  }
  console.log();
}

// Also check: quotes with invalidReason='hallucinated_words' that have 0 fabricated words
// These might be mislabeled
console.log('\n=== QUOTES WITH hallucinated_words BUT 0 FABRICATED WORDS ===\n');
let mislabeled = 0;
for (const [modelId, entry] of Object.entries(results) as any[]) {
  const quotes = entry.quotes || [];
  for (const q of quotes) {
    if (q.invalidReason === 'hallucinated_words' && q.fabricationAnalysis) {
      const fabCount = q.fabricationAnalysis.stats.fabricatedWords;
      if (fabCount === 0) {
        mislabeled++;
        console.log(`  ${entry.modelName || modelId} [${q.reference}]: hallucinated_words but 0 fabricated words`);
      }
    }
  }
}
if (mislabeled === 0) console.log('  None found.');

// Check: quotes with 'fabricated' reason - these are entirely fake verses
console.log('\n=== FULLY FABRICATED VERSES ===\n');
for (const [modelId, entry] of Object.entries(results) as any[]) {
  const quotes = entry.quotes || [];
  for (const q of quotes) {
    if (q.invalidReason === 'fabricated') {
      const fabCount = q.fabricationAnalysis?.stats?.fabricatedWords || 0;
      const totalWords = q.fabricationAnalysis?.stats?.totalWords || 0;
      console.log(`  ${entry.modelName || modelId} [${q.reference}]: ${fabCount}/${totalWords} words don't exist in Quran`);
    }
  }
}
