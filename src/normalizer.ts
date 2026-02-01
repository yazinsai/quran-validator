import type { NormalizationOptions } from './types';

/**
 * Arabic Unicode character ranges and patterns
 */
const ARABIC_PATTERNS = {
  // Diacritics (tashkeel) - Fatha, Kasra, Damma, Sukun, Shadda, Tanween, etc.
  diacritics: /[\u064B-\u065F\u0670\u06D6-\u06ED]/g,

  // Alef variants: أ إ آ ٱ (not plain alef ا)
  alefVariants: /[أإآٱ]/g,

  // Alef maqsura: ى
  alefMaqsura: /ى/g,

  // Teh marbuta: ة
  tehMarbuta: /ة/g,

  // Tatweel (kashida): ـ
  tatweel: /ـ/g,

  // Waw with hamza above: ؤ
  wawHamza: /ؤ/g,

  // Ya with hamza above: ئ
  yaHamza: /ئ/g,

  // Hamza variants (standalone): ء
  hamzaStandalone: /ء/g,

  // Multiple whitespace
  multipleSpaces: /\s+/g,

  // Arabic-specific punctuation that might appear in quotes
  punctuation: /[،؛؟]/g,
};

/**
 * Default normalization options
 */
const DEFAULT_OPTIONS: Required<NormalizationOptions> = {
  removeDiacritics: true,
  normalizeAlef: true,
  normalizeAlefMaqsura: true,
  normalizeTehMarbuta: true,
  removeTatweel: true,
  normalizeHamza: true,
  normalizeWhitespace: true,
};

/**
 * Normalize Arabic text for comparison
 *
 * This function applies various normalization rules to make Arabic text
 * comparison more reliable, especially for Quranic verses which may be
 * written with different levels of diacritical marks.
 *
 * @param text - The Arabic text to normalize
 * @param options - Normalization options
 * @returns Normalized text
 *
 * @example
 * ```ts
 * normalizeArabic("بِسْمِ اللَّهِ") // returns "بسم الله"
 * normalizeArabic("الرَّحْمَٰنِ") // returns "الرحمن"
 * ```
 */
export function normalizeArabic(
  text: string,
  options: NormalizationOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let result = text;

  // Remove diacritics (tashkeel)
  if (opts.removeDiacritics) {
    result = result.replace(ARABIC_PATTERNS.diacritics, '');
  }

  // Normalize alef variants (أ إ آ ٱ) to plain alef (ا)
  if (opts.normalizeAlef) {
    result = result.replace(ARABIC_PATTERNS.alefVariants, 'ا');
  }

  // Normalize alef maqsura (ى) to ya (ي)
  if (opts.normalizeAlefMaqsura) {
    result = result.replace(ARABIC_PATTERNS.alefMaqsura, 'ي');
  }

  // Normalize teh marbuta (ة) to heh (ه)
  if (opts.normalizeTehMarbuta) {
    result = result.replace(ARABIC_PATTERNS.tehMarbuta, 'ه');
  }

  // Remove tatweel (kashida)
  if (opts.removeTatweel) {
    result = result.replace(ARABIC_PATTERNS.tatweel, '');
  }

  // Normalize hamza carriers
  if (opts.normalizeHamza) {
    result = result.replace(ARABIC_PATTERNS.wawHamza, 'و');
    result = result.replace(ARABIC_PATTERNS.yaHamza, 'ي');
  }

  // Normalize whitespace
  if (opts.normalizeWhitespace) {
    result = result.replace(ARABIC_PATTERNS.multipleSpaces, ' ').trim();
  }

  return result;
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
  return text.replace(ARABIC_PATTERNS.diacritics, '');
}

/**
 * Check if text contains Arabic characters
 *
 * @param text - The text to check
 * @returns True if text contains Arabic characters
 */
export function containsArabic(text: string): boolean {
  // Arabic Unicode ranges:
  // - Arabic: U+0600-U+06FF
  // - Arabic Supplement: U+0750-U+077F
  // - Arabic Extended-A: U+08A0-U+08FF
  // - Arabic Presentation Forms-A: U+FB50-U+FDFF
  // - Arabic Presentation Forms-B: U+FE70-U+FEFF
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

  // Match continuous Arabic text (including spaces between Arabic words)
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

/**
 * Calculate Levenshtein distance between two strings
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Edit distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create distance matrix
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize first column
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }

  // Initialize first row
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
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

  // Use a simple character-by-character comparison
  // This is a basic implementation - could be enhanced with more sophisticated diff algorithms
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

  // Handle remaining differences
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
