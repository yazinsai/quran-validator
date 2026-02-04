import fs from 'fs';
import path from 'path';

const CACHE_DIR = process.env.CACHE_DIR || process.cwd();
const CACHE_FILE = path.join(CACHE_DIR, 'cache.json');

export type InvalidReason =
  | 'fabricated'           // No match anywhere in Quran (confidence < 0.4)
  | 'hallucinated_words'   // Partial match - some words don't exist
  | 'wrong_reference'      // Text is valid Quran but from different verse than claimed
  | 'invalid_reference'    // Cited surah:ayah that doesn't exist
  | 'diacritics_error'     // Correct letters, wrong tashkeel
  | 'truncated'            // Only part of a verse
  | null;

export type PromptType = 'topical' | 'specific';

export interface CachedQuote {
  reference: string;
  expectedReference?: string;  // For specific prompts where we know what to expect
  isValid: boolean;
  confidence: number;
  original: string;
  corrected?: string;
  invalidReason?: InvalidReason;
  promptType?: PromptType;  // Optional for backwards compatibility with old cache
}

export interface PromptResult {
  promptType: PromptType;
  promptText: string;
  quotes: CachedQuote[];
  validCount: number;
  totalCount: number;
  accuracy: number;
  noArabicContent: boolean;  // Model didn't provide any Arabic
  rawResponse?: string;  // Store raw model response for debugging
}

export interface CachedResult {
  modelId: string;
  modelName: string;
  icon: string;
  timestamp: number;
  // Legacy flat structure for backwards compatibility
  quotes: CachedQuote[];
  validCount: number;
  totalCount: number;
  accuracy: number;
  // New structured results by prompt
  promptResults?: PromptResult[];
  // Error breakdown for filtering/analysis
  errorBreakdown?: Record<string, number>;
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
