import { normalize, type NormalizeOptions } from 'arabic-text-normalizer';

// Re-export the library's options type
export type { NormalizeOptions };

// Bidi / zero-width control characters often present in pasted text
const BIDI_CONTROLS = /[\u200c\u200d\u200e\u200f\u061c]/g;

/**
 * Normalize Arabic text for comparison
 *
 * Uses arabic-text-normalizer for core normalization, with additional
 * NFKC decomposition and bidi control stripping.
 *
 * @param text - The Arabic text to normalize
 * @param options - Normalization options (passed to arabic-text-normalizer)
 * @returns Normalized text
 *
 * @example
 * ```ts
 * normalizeArabic("بِسْمِ اللَّهِ") // returns "بسم الله"
 * normalizeArabic("الرَّحْمَٰنِ") // returns "الرحمان"
 * ```
 */
export function normalizeArabic(
  text: string,
  options?: NormalizeOptions
): string {
  // NFKC decomposes presentation forms (e.g., ﷲ → الله) before normalization
  let result = text.normalize('NFKC');

  // Strip bidi and zero-width controls that affect equality but not content
  result = result.replace(BIDI_CONTROLS, '');

  return normalize(result, options);
}

/**
 * Remove only diacritics (tashkeel) from Arabic text
 *
 * This preserves the base letters but removes vowel marks,
 * shadda, sukun, and other diacritical marks.
 *
 * @param text - The Arabic text
 * @returns Text without diacritics
 *
 * @example
 * ```ts
 * removeDiacritics("السَّلَامُ عَلَيْكُمُ") // returns "السلام عليكم"
 * ```
 */
export function removeDiacritics(text: string): string {
  return normalize(text, {
    diacritics: true,
    markers: false,
    verseNumbers: false,
    tatweel: false,
    smallLetters: false,
    punctuation: false,
    collapseWhitespace: false,
  });
}

/**
 * Check if text contains Arabic characters
 *
 * @param text - The text to check
 * @returns True if text contains Arabic characters
 */
export function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(
    text
  );
}

/**
 * Extract Arabic text segments from mixed text
 *
 * @param text - Text that may contain Arabic and non-Arabic content
 * @returns Array of Arabic text segments with their positions
 */
export function extractArabicSegments(
  text: string
): { text: string; startIndex: number; endIndex: number }[] {
  const segments: { text: string; startIndex: number; endIndex: number }[] = [];

  const arabicPattern =
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF][\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]*/g;

  let match;
  while ((match = arabicPattern.exec(text)) !== null) {
    const segment = match[0].trim();
    if (segment.length > 0) {
      segments.push({
        text: segment,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
  }

  return segments;
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity score between 0 and 1 (1 = identical)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;

  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);

  return 1 - distance / maxLength;
}

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }

  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Find differences between two strings
 *
 * @param input - The input string
 * @param correct - The correct string
 * @returns Array of differences with positions
 */
export function findDifferences(
  input: string,
  correct: string
): { input: string; correct: string; position: number }[] {
  const differences: { input: string; correct: string; position: number }[] =
    [];

  const minLength = Math.min(input.length, correct.length);
  let diffStart = -1;
  let inputChunk = '';
  let correctChunk = '';

  for (let i = 0; i < minLength; i++) {
    if (input[i] !== correct[i]) {
      if (diffStart === -1) {
        diffStart = i;
      }
      inputChunk += input[i];
      correctChunk += correct[i];
    } else if (diffStart !== -1) {
      differences.push({
        input: inputChunk,
        correct: correctChunk,
        position: diffStart,
      });
      diffStart = -1;
      inputChunk = '';
      correctChunk = '';
    }
  }

  if (diffStart !== -1 || input.length !== correct.length) {
    if (diffStart === -1) {
      diffStart = minLength;
    }
    inputChunk += input.slice(diffStart !== -1 ? diffStart + inputChunk.length : minLength);
    correctChunk += correct.slice(diffStart !== -1 ? diffStart + correctChunk.length : minLength);

    if (inputChunk || correctChunk) {
      differences.push({
        input: inputChunk || '(missing)',
        correct: correctChunk || '(extra)',
        position: diffStart,
      });
    }
  }

  return differences;
}
