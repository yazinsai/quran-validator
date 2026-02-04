import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'cache.json');

export interface CachedResult {
  modelId: string;
  modelName: string;
  icon: string;
  timestamp: number;
  quotes: {
    reference: string;
    isValid: boolean;
    confidence: number;
    original: string;
    corrected?: string;
  }[];
  validCount: number;
  totalCount: number;
  accuracy: number;
}

interface Cache {
  results: Record<string, CachedResult>;
}

function readCache(): Cache {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Error reading cache:', e);
  }
  return { results: {} };
}

function writeCache(cache: Cache): void {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (e) {
    console.error('Error writing cache:', e);
  }
}

export function getCachedResult(modelId: string): CachedResult | null {
  const cache = readCache();
  return cache.results[modelId] || null;
}

export function setCachedResult(result: CachedResult): void {
  const cache = readCache();
  cache.results[result.modelId] = result;
  writeCache(cache);
}

export function getAllCachedResults(): CachedResult[] {
  const cache = readCache();
  return Object.values(cache.results).sort((a, b) => b.accuracy - a.accuracy);
}

export function clearCache(): void {
  writeCache({ results: {} });
}
