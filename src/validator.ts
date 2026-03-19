import type {
  QuranVerse,
  QuranSurah,
  ValidationResult,
  DetectionResult,
  ValidatorOptions,
  MatchType,
  FabricationAnalysis,
  WordAnalysis,
} from './types';
import {
  normalizeArabic,
  containsArabic,
  extractArabicSegments,
} from './normalizer';

/**
 * Aggressive normalization for fabrication checking using stripHamza option.
 * This handles LLM output vs Uthmani differences by stripping hamza carriers
 * and normalizing alef maqsura.
 */
function normalizeFabrication(text: string): string {
  return normalizeArabic(text, { stripHamza: true });
}

// Import bundled data
import versesData from '../data/quran-verses.min.json';
import surahsData from '../data/quran-surahs.min.json';

/**
 * Default validator options
 */
const DEFAULT_OPTIONS: Required<ValidatorOptions> = {
  maxSuggestions: 3,
  minDetectionLength: 10,
};

/**
 * QuranValidator - Validate and verify Quranic verses in text
 *
 * @example
 * ```ts
 * import { QuranValidator } from 'quran-validator';
 *
 * const validator = new QuranValidator();
 *
 * // Validate a specific quote
 * const result = validator.validate("بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ");
 * console.log(result.isValid); // true
 * console.log(result.reference); // "1:1"
 *
 * // Detect and validate all Quran quotes in text
 * const detection = validator.detectAndValidate(llmOutput);
 * for (const segment of detection.segments) {
 *   console.log(segment.text, segment.validation?.isValid);
 * }
 * ```
 */
export class QuranValidator {
  private verses: QuranVerse[];
  private surahs: QuranSurah[];
  private options: Required<ValidatorOptions>;

  // Pre-computed normalized data for faster lookups
  private normalizedVerseMap: Map<string, QuranVerse[]>;
  private verseById: Map<number, QuranVerse>;
  private verseBySurahAyah: Map<string, QuranVerse>;
  private exactVerseMap: Map<string, QuranVerse>;

  // Concatenated normalized corpus for fabrication detection
  private normalizedCorpus: string;

  constructor(options: ValidatorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Load verses and surahs from bundled data
    this.verses = versesData as QuranVerse[];
    this.surahs = surahsData as QuranSurah[];

    // Build lookup maps
    this.verseById = new Map();
    this.verseBySurahAyah = new Map();
    this.exactVerseMap = new Map();
    this.normalizedVerseMap = new Map();

    const corpusTexts: string[] = [];

    for (const verse of this.verses) {
      this.verseById.set(verse.id, verse);
      this.verseBySurahAyah.set(`${verse.surah}:${verse.ayah}`, verse);
      this.exactVerseMap.set(verse.text, verse);

      const normalized = normalizeFabrication(verse.text);
      const existing = this.normalizedVerseMap.get(normalized) || [];
      existing.push(verse);
      this.normalizedVerseMap.set(normalized, existing);

      corpusTexts.push(normalized);
    }

    // Build concatenated corpus for fabrication detection
    this.normalizedCorpus = corpusTexts.join(' ');
  }

  /**
   * Validate a potential Quran quote
   *
   * @param text - The Arabic text to validate
   * @returns Validation result with match details
   *
   * @example
   * ```ts
   * const result = validator.validate("بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ");
   * if (result.isValid) {
   *   console.log(`Found: ${result.reference}`); // "1:1"
   *   console.log(`Match type: ${result.matchType}`); // "exact"
   * }
   * ```
   */
  validate(text: string): ValidationResult {
    const trimmedText = text.trim();
    const normalizedInput = normalizeArabic(trimmedText);
    // Use aggressive normalization for lookup (handles ى/ي and hamza variations)
    const lookupKey = normalizeFabrication(trimmedText);

    // Early exit if not Arabic
    if (!containsArabic(trimmedText)) {
      return this.noMatch(normalizedInput);
    }

    // Step 1: Try exact match (with diacritics)
    const exactMatch = this.findExactMatch(trimmedText);
    if (exactMatch) {
      return this.createResult(exactMatch, 'exact', normalizedInput);
    }

    // Step 2: Try normalized match (handles script variations)
    const normalizedMatches = this.normalizedVerseMap.get(lookupKey);

    if (normalizedMatches && normalizedMatches.length > 0) {
      const primary = normalizedMatches[0];
      const result = this.createResult(primary, 'normalized', normalizedInput);

      if (normalizedMatches.length > 1) {
        result.suggestions = normalizedMatches
          .slice(0, this.options.maxSuggestions)
          .map((v) => ({
            verse: v,
            reference: `${v.surah}:${v.ayah}`,
          }));
      }

      return result;
    }

    // No match found
    return this.noMatch(normalizedInput);
  }

  /**
   * Validate text against a specific verse reference
   *
   * @param text - The Arabic text to validate
   * @param reference - The expected verse reference (e.g., "1:1" or "2:255-257")
   * @returns Validation result with diff information
   *
   * @example
   * ```ts
   * const result = validator.validateAgainst("بسم الله", "1:1");
   * if (!result.isValid) {
   *   console.log(`Expected: ${result.expectedNormalized}`);
   *   console.log(`Got: ${result.normalizedInput}`);
   *   console.log(`Mismatch at index: ${result.mismatchIndex}`);
   * }
   * ```
   */
  validateAgainst(text: string, reference: string): ValidationResult {
    const trimmedText = text.trim();
    const normalizedInput = normalizeArabic(trimmedText);

    // Parse the reference
    const rangeMatch = reference.match(/^(\d+):(\d+)(?:-(\d+))?$/);
    if (!rangeMatch) {
      return this.noMatch(normalizedInput);
    }

    const surah = parseInt(rangeMatch[1], 10);
    const startAyah = parseInt(rangeMatch[2], 10);
    const endAyah = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : startAyah;

    // Get the expected verse(s)
    let expectedText: string;
    let matchedVerse: QuranVerse | undefined;

    if (startAyah === endAyah) {
      // Single verse
      matchedVerse = this.getVerse(surah, startAyah);
      if (!matchedVerse) {
        return this.noMatch(normalizedInput);
      }
      expectedText = matchedVerse.text;
    } else {
      // Verse range
      const range = this.getVerseRange(surah, startAyah, endAyah);
      if (!range) {
        return this.noMatch(normalizedInput);
      }
      expectedText = range.text;
      matchedVerse = range.verses[0];
    }

    const expectedNormalized = normalizeArabic(expectedText);

    // Check for exact match
    if (trimmedText === expectedText) {
      return {
        isValid: true,
        matchType: 'exact',
        matchedVerse,
        reference,
        normalizedInput,
        expectedNormalized,
      };
    }

    // Check for normalized match (use aggressive normalization for ى/ي and hamza variations)
    const inputLookup = normalizeFabrication(trimmedText);
    const expectedLookup = normalizeFabrication(expectedText);
    if (inputLookup === expectedLookup) {
      return {
        isValid: true,
        matchType: 'normalized',
        matchedVerse,
        reference,
        normalizedInput,
        expectedNormalized,
      };
    }

    // No match - find where the mismatch starts
    const mismatchIndex = this.findMismatchIndex(inputLookup, expectedLookup);

    return {
      isValid: false,
      matchType: 'none',
      reference,
      normalizedInput,
      expectedNormalized,
      mismatchIndex,
    };
  }

  /**
   * Detect and validate all potential Quran quotes in text
   *
   * This is useful for post-processing LLM output to find and verify
   * any Quranic content.
   *
   * @param text - Text that may contain Quran quotes
   * @returns Detection result with validated segments
   *
   * @example
   * ```ts
   * const llmOutput = "The verse بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ means...";
   * const result = validator.detectAndValidate(llmOutput);
   *
   * for (const segment of result.segments) {
   *   if (segment.validation?.isValid) {
   *     console.log(`Valid quote: ${segment.text}`);
   *   } else {
   *     console.log(`Possible misquote: ${segment.text}`);
   *   }
   * }
   * ```
   */
  detectAndValidate(text: string): DetectionResult {
    // Extract Arabic segments
    const arabicSegments = extractArabicSegments(text);

    if (arabicSegments.length === 0) {
      return { detected: false, segments: [] };
    }

    // Filter by minimum length and validate each
    const validatedSegments = arabicSegments
      .filter((seg) => seg.text.length >= this.options.minDetectionLength)
      .map((seg) => ({
        text: seg.text,
        startIndex: seg.startIndex,
        endIndex: seg.endIndex,
        validation: this.validate(seg.text),
      }));

    // A detection is positive if we found any valid Quran content
    const detected = validatedSegments.some(
      (seg) => seg.validation.isValid
    );

    return {
      detected,
      segments: validatedSegments,
    };
  }

  /**
   * Get a verse by reference (surah:ayah)
   *
   * @param surah - Surah number (1-114)
   * @param ayah - Ayah number
   * @returns The verse or undefined if not found
   */
  getVerse(surah: number, ayah: number): QuranVerse | undefined {
    return this.verseBySurahAyah.get(`${surah}:${ayah}`);
  }

  /**
   * Get a range of verses and concatenate their text
   *
   * @param surah - Surah number (1-114)
   * @param startAyah - Starting ayah number
   * @param endAyah - Ending ayah number
   * @returns Object with concatenated text and verses array, or undefined if invalid range
   */
  getVerseRange(
    surah: number,
    startAyah: number,
    endAyah: number
  ): { text: string; textSimple: string; verses: QuranVerse[] } | undefined {
    if (startAyah > endAyah) return undefined;

    const verses: QuranVerse[] = [];
    for (let ayah = startAyah; ayah <= endAyah; ayah++) {
      const verse = this.getVerse(surah, ayah);
      if (!verse) return undefined; // Invalid range
      verses.push(verse);
    }

    return {
      text: verses.map((v) => v.text).join(' '),
      textSimple: verses.map((v) => v.textSimple).join(' '),
      verses,
    };
  }

  /**
   * Get all verses in a surah
   *
   * @param surahNumber - Surah number (1-114)
   * @returns Array of verses in the surah
   */
  getSurahVerses(surahNumber: number): QuranVerse[] {
    return this.verses.filter((v) => v.surah === surahNumber);
  }

  /**
   * Get surah information
   *
   * @param surahNumber - Surah number (1-114)
   * @returns Surah info or undefined
   */
  getSurah(surahNumber: number): QuranSurah | undefined {
    return this.surahs.find((s) => s.number === surahNumber);
  }

  /**
   * Get all surahs
   */
  getAllSurahs(): QuranSurah[] {
    return [...this.surahs];
  }

  /**
   * Search verses by text (containment-based matching)
   *
   * @param query - Search query (Arabic text)
   * @param limit - Maximum results to return
   * @returns Matching verses sorted by relevance
   */
  search(
    query: string,
    limit: number = 10
  ): { verse: QuranVerse; similarity: number }[] {
    const normalizedQuery = normalizeArabic(query.trim());
    if (!normalizedQuery) return [];
    const results: { verse: QuranVerse; similarity: number }[] = [];

    for (const verse of this.verses) {
      const normalizedVerse = normalizeArabic(verse.text);

      // Query contained in verse
      if (normalizedVerse.includes(normalizedQuery)) {
        const ratio = normalizedQuery.length / normalizedVerse.length;
        results.push({ verse, similarity: 0.7 + ratio * 0.3 });
      }
      // Verse contained in query
      else if (normalizedQuery.includes(normalizedVerse)) {
        const ratio = normalizedVerse.length / normalizedQuery.length;
        results.push({ verse, similarity: 0.5 + ratio * 0.3 });
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Analyze text for fabricated words that don't exist in the Quran
   *
   * Uses greedy longest contiguous match algorithm:
   * - Words that exist as part of any contiguous sequence in the Quran are valid
   * - Words that cannot be found anywhere in the Quran corpus are marked as fabricated
   *
   * @param text - The Arabic text to analyze
   * @returns Analysis with word-by-word breakdown
   *
   * @example
   * ```ts
   * const analysis = validator.analyzeFabrication('بسم الله الفلان');
   * // 'بسم' and 'الله' are valid (exist in Quran)
   * // 'الفلان' is fabricated (doesn't exist anywhere)
   * console.log(analysis.stats.fabricatedWords); // 1
   * ```
   */
  analyzeFabrication(text: string): FabricationAnalysis {
    const normalizedInput = normalizeArabic(text);
    // Use aggressive normalization for matching against corpus
    const fabricationNormalized = normalizeFabrication(text);
    const words = normalizedInput.split(/\s+/).filter(Boolean);
    const fabricationWords = fabricationNormalized.split(/\s+/).filter(Boolean);
    const results: WordAnalysis[] = [];

    if (words.length === 0) {
      return {
        normalizedInput,
        words: [],
        stats: {
          totalWords: 0,
          fabricatedWords: 0,
          fabricatedRatio: 0,
        },
      };
    }

    let i = 0;
    while (i < fabricationWords.length) {
      // Binary search for longest contiguous match starting at position i
      let lo = 1;
      let hi = fabricationWords.length - i;
      let best = 0;

      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        // Use aggressively normalized words for matching
        const candidate = fabricationWords.slice(i, i + mid).join(' ');

        if (this.normalizedCorpus.includes(candidate)) {
          best = mid;
          lo = mid + 1; // Try longer
        } else {
          hi = mid - 1; // Try shorter
        }
      }

      if (best > 0) {
        // Found contiguous match — mark words [i, i+best) as valid
        // Use original normalized words for display
        for (let j = i; j < i + best; j++) {
          results.push({ word: words[j], isFabricated: false });
        }
        i += best;
      } else {
        // No match at all — word doesn't exist even alone
        results.push({ word: words[i], isFabricated: true });
        i++;
      }
    }

    const fabricatedWords = results.filter((w) => w.isFabricated).length;

    return {
      normalizedInput,
      words: results,
      stats: {
        totalWords: results.length,
        fabricatedWords,
        fabricatedRatio: results.length > 0 ? fabricatedWords / results.length : 0,
      },
    };
  }

  // Private helper methods

  private findExactMatch(text: string): QuranVerse | undefined {
    return this.exactVerseMap.get(text);
  }

  private createResult(
    verse: QuranVerse,
    matchType: MatchType,
    normalizedInput: string
  ): ValidationResult {
    return {
      isValid: true,
      matchType,
      matchedVerse: verse,
      reference: `${verse.surah}:${verse.ayah}`,
      normalizedInput,
    };
  }

  private noMatch(normalizedInput?: string): ValidationResult {
    return {
      isValid: false,
      matchType: 'none',
      normalizedInput,
    };
  }

  /**
   * Find the character index where two strings first differ
   */
  private findMismatchIndex(str1: string, str2: string): number {
    const minLen = Math.min(str1.length, str2.length);
    for (let i = 0; i < minLen; i++) {
      if (str1[i] !== str2[i]) {
        return i;
      }
    }
    // If we get here, one string is a prefix of the other
    if (str1.length !== str2.length) {
      return minLen;
    }
    return -1; // Strings are identical (shouldn't happen if called correctly)
  }
}

/**
 * Create a new QuranValidator instance
 *
 * @param options - Validator options
 * @returns QuranValidator instance
 *
 * @example
 * ```ts
 * import { createValidator } from 'quran-validator';
 *
 * const validator = createValidator();
 * ```
 */
export function createValidator(options?: ValidatorOptions): QuranValidator {
  return new QuranValidator(options);
}
