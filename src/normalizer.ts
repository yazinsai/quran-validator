import type { NormalizationOptions } from './types';

/**
 * Arabic Unicode character ranges and patterns
 */
const ARABIC_PATTERNS = {
  // Diacritics (tashkeel) - Fatha, Kasra, Damma, Sukun, Shadda, Tanween, etc.
  // Note: U+0670 (superscript alef) is handled separately to convert to alef, not remove
  // Range U+064B-U+065F covers: fatha, damma, kasra, shadda, sukun, and hamza above (U+0654)
  // Range U+06D6-U+06ED covers: Quranic annotation marks
  diacritics: /[\u064B-\u0653\u0655-\u065F\u06D6-\u06ED]/g,

  // Hamza above (U+0654) - needs special handling for Uthmani script
  // In Uthmani: tatweel + hamza above (ـٔ) = alef-hamza (أ) in common Arabic
  hamzaAbove: /\u0654/g,

  // Hamza above followed by alef variants (ـٔا / ـٔأ / ـٔإ / ـٔآ / ـٔٱ)
  // In Uthmani, hamza above on tatweel before alef represents alef-hamza (أ)
  // Common Arabic already has the alef, so remove the hamza to avoid double alef
  hamzaAboveBeforeAlef: /\u0654(?=[\u064B-\u065F]*[اأإآٱ])/g,

  // Superscript alef (U+0670) - used in Uthmani for long 'a' sound
  // Common Arabic uses regular alef (ا) instead
  superscriptAlef: /\u0670/g,

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

  // Ya-hamza followed by waw: ئو → وو (to match hamza-above-waw pattern)
  yaHamzaBeforeWaw: /ئ(?=و)/g,

  // Hamza variants (standalone): ء
  hamzaStandalone: /ء/g,

  // Standalone hamza before alef variants (ءا / ءأ / ءإ / ءآ / ءٱ), allowing diacritics
  // Some texts encode alef-hamza as separate hamza + alef, so collapse to alef
  hamzaStandaloneBeforeAlef: /ء(?=[\u064B-\u065F]*[\u0627\u0623\u0625\u0622\u0671])/g,

  // Multiple whitespace
  multipleSpaces: /\s+/g,

  // Arabic-Indic digits: ٠-٩ and Eastern Arabic digits: ۰-۹
  arabicIndicDigits: /[٠-٩]/g,
  easternArabicDigits: /[۰-۹]/g,

  // Bidi / zero-width control characters often present in pasted text
  bidiControls: /[\u200c\u200d\u200e\u200f\u061c]/g,

  // Arabic-specific punctuation that might appear in quotes
  punctuation: /[،؛؟]/g,

  // Quranic section markers (rubul-hizb ۞, etc.)
  sectionMarkers: /[\u06DD-\u06DE]/g,

  // Alef before noon in middle of word (الرحمان → الرحمن)
  // Only remove alef when it's preceded by a consonant (not at word start)
  // This avoids breaking words like انما where the alef is legitimate
  alefBeforeNoon: /(?<=[بتثجحخدذرزسشصضطظعغفقكلمنهوي])ا(?=ن)/g,

  // Alef after ya at word boundary (اليتاميا → اليتامي)
  // In Uthmani, words ending with alef maqsura (ى) often have superscript alef
  // After normalization: ى→ي + superscript→ا = يا
  // But common Arabic just has ي, so remove the trailing alef after ya
  alefAfterYaAtEnd: /يا(?=\s|$)/g,

  // Alef before heh at end of word (الاه → اله for words like إله)
  // In Uthmani, words like إله have superscript alef that becomes regular alef
  // but common Arabic doesn't have the alef in these positions
  // Pattern: lam + alef + heh at word boundary
  lamAlefHehAtEnd: /لاه(?=\s|$)/g,
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
  normalizePresentationForms: true,
  normalizeDigits: true,
  stripBidiControls: true,
  applyUthmaniHeuristics: true,
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

  // Normalize compatibility/presentation forms (e.g., ligatures) before other transforms
  if (opts.normalizePresentationForms) {
    result = result.normalize('NFKC');
  }

  // Strip bidi and zero-width controls that affect equality but not content
  if (opts.stripBidiControls) {
    result = result.replace(ARABIC_PATTERNS.bidiControls, '');
  }

  // Remove Quranic section markers (rubul-hizb ۞, etc.)
  result = result.replace(ARABIC_PATTERNS.sectionMarkers, '');

  if (opts.applyUthmaniHeuristics) {
    // IMPORTANT: Handle Uthmani-specific patterns BEFORE removing diacritics
    // Convert superscript alef (ٰ, U+0670) to regular alef (ا)
    // In Uthmani: الصَّدَقَـٰتُ → In common: الصدقات
    // Note: This means الرحمٰن → الرحمان (but common Arabic uses الرحمن)
    // We accept this because most words need the alef conversion
    result = result.replace(ARABIC_PATTERNS.superscriptAlef, 'ا');

    // Handle hamza above (ٔ, U+0654) in Uthmani script
    // Context matters:
    // - يَسْـَٔلُونَكَ → hamza above represents alef-hamza (أ) → convert to alef
    // - يَـُٔودُهُ → hamza above represents waw-hamza (ؤ) → convert to waw
    // - سَيِّـَٔاتِ → hamza above after ya represents ya-hamza (ئ) → remove (ya already present)
    //
    // Heuristics:
    // 1. hamza above followed by waw → convert to waw (waw-hamza case)
    // 2. hamza above after ya → remove (ya-hamza case, ya already exists)
    // 3. hamza above before alef → remove (alef already present)
    // 4. standalone hamza before alef → remove (alef already present)
    // 5. Otherwise → convert to alef (alef-hamza case)
    result = result.replace(/\u0654(?=[\u064B-\u065F]*\u0648)/g, 'و'); // hamza before waw → waw
    result = result.replace(/(?<=\u064A[\u064B-\u065F\u0640]*)\u0654/g, ''); // hamza after ya (allowing tatweel) → remove
    result = result.replace(ARABIC_PATTERNS.hamzaAboveBeforeAlef, ''); // hamza before alef → remove
    result = result.replace(ARABIC_PATTERNS.hamzaStandaloneBeforeAlef, ''); // standalone hamza before alef → remove
    result = result.replace(ARABIC_PATTERNS.hamzaAbove, 'ا'); // remaining hamza → alef
  }

  // Remove diacritics (tashkeel) - but NOT superscript alef or hamza above (handled above)
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
    // Ya-hamza before waw → waw (to match hamza-above-waw → waw pattern)
    // This handles يئود vs يـٔود spelling variants
    result = result.replace(ARABIC_PATTERNS.yaHamzaBeforeWaw, 'و');
    // Ya-hamza after ya → remove (to match hamza-above after ya → remove)
    // This handles سيئات vs سيـٔات spelling variants
    result = result.replace(/(?<=ي)ئ/g, '');
    result = result.replace(ARABIC_PATTERNS.yaHamza, 'ي');
  }

  // Normalize digits to ASCII
  if (opts.normalizeDigits) {
    result = result
      .replace(ARABIC_PATTERNS.arabicIndicDigits, (d) =>
        String(d.charCodeAt(0) - 0x0660)
      )
      .replace(ARABIC_PATTERNS.easternArabicDigits, (d) =>
        String(d.charCodeAt(0) - 0x06f0)
      );
  }

  // Normalize whitespace
  if (opts.normalizeWhitespace) {
    result = result.replace(ARABIC_PATTERNS.multipleSpaces, ' ').trim();
  }

  if (opts.applyUthmaniHeuristics) {
    // Normalize alef before noon (الرحمان → الرحمن)
    // This handles Uthmani spellings where superscript alef becomes regular alef
    // but common Arabic doesn't use the alef in these words
    result = result.replace(ARABIC_PATTERNS.alefBeforeNoon, '');

    // Normalize alef after ya at word end (اليتاميا → اليتامي)
    // This handles Uthmani spellings where alef maqsura + superscript alef
    // becomes ya + alef, but common Arabic just uses ya
    result = result.replace(ARABIC_PATTERNS.alefAfterYaAtEnd, 'ي');

    // Normalize lam-alef-heh to lam-heh (الاه → اله for words like إله)
    // This handles Uthmani spellings where superscript alef creates an extra alef
    result = result.replace(ARABIC_PATTERNS.lamAlefHehAtEnd, 'له');
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
