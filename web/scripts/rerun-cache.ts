/**
 * Re-run benchmarks for all models in the cache to capture rawResponse
 * Run with: npx tsx scripts/rerun-cache.ts
 *
 * Options:
 *   --concurrency=N  Number of parallel requests (default: 5)
 */

import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load env
config({ path: path.join(__dirname, '../.env') });

const CACHE_FILE = process.env.CACHE_DIR
  ? path.join(process.env.CACHE_DIR, 'cache.json')
  : path.join(__dirname, '../cache.json');

import { runBenchmark } from '../lib/benchmark';

interface CacheEntry {
  modelId: string;
  modelName: string;
  icon: string;
}

// Parse CLI args
const args = process.argv.slice(2);
const concurrencyArg = args.find(a => a.startsWith('--concurrency='));
const CONCURRENCY = concurrencyArg ? parseInt(concurrencyArg.split('=')[1], 10) : 5;

async function processModel(model: CacheEntry): Promise<{ model: CacheEntry; success: boolean; message: string }> {
  try {
    const result = await runBenchmark(model.modelId, model.modelName, model.icon, true);
    return {
      model,
      success: true,
      message: `${result.validCount}/${result.totalCount} valid (${result.accuracy}%)`,
    };
  } catch (error) {
    return {
      model,
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function processInParallel<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];
      const result = await processor(item);
      results[currentIndex] = result;
    }
  }

  // Start workers up to concurrency limit
  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}

async function main() {
  // Read existing cache
  const cacheContent = fs.readFileSync(CACHE_FILE, 'utf-8');
  const cache = JSON.parse(cacheContent);

  const models: CacheEntry[] = Object.values(cache.results);

  console.log(`Found ${models.length} models in cache.`);
  console.log(`Re-running benchmarks with concurrency=${CONCURRENCY}...\n`);

  const startTime = Date.now();
  let completed = 0;

  const results = await processInParallel(
    models,
    async (model) => {
      const result = await processModel(model);
      completed++;
      const status = result.success ? '✓' : '✗';
      console.log(`[${completed}/${models.length}] ${status} ${model.modelName}: ${result.message}`);
      return result;
    },
    CONCURRENCY
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log(`\nDone in ${elapsed}s!`);
  console.log(`  ✓ ${successCount} succeeded`);
  if (failCount > 0) {
    console.log(`  ✗ ${failCount} failed`);
  }
}

main().catch(console.error);
