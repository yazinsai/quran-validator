import type { CachedResult } from './cache';

/** Count total issues from errorBreakdown */
function errorCount(r: CachedResult): number {
  if (!r.errorBreakdown) return 0;
  return Object.values(r.errorBreakdown).reduce((sum, n) => sum + n, 0);
}

/**
 * Leaderboard comparator. Tiebreakers when accuracy is equal:
 * 1. Fewer total errors (diacritics, truncations, etc.)
 * 2. More quotes tested (broader coverage is more impressive)
 */
export function compareResults(a: CachedResult, b: CachedResult): number {
  if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
  if (errorCount(a) !== errorCount(b)) return errorCount(a) - errorCount(b);
  return b.totalCount - a.totalCount;
}
