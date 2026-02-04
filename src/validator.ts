import type {
  QuranVerse,
  QuranSurah,
  ValidationResult,
  DetectionResult,
  ValidatorOptions,
  MatchType,
} from './types';
import {
  normalizeArabic,
  containsArabic,
  extractArabicSegments,
} from './normalizer';

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

  constructor(options: ValidatorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Load verses and surahs from bundled data
    this.verses = versesData as QuranVerse[];
    this.surahs = surahsData as QuranSurah[];

    // Build lookup maps
    this.verseById = new Map();
    this.normalizedVerseMap = new Map();

    for (const verse of this.verses) {
      // ID lookup
      this.verseById.set(verse.id, verse);

      // Normalized text lookup
      const normalized = normalizeArabic(verse.text);
      const existing = this.normalizedVerseMap.get(normalized) || [];
      existing.push(verse);
      this.normalizedVerseMap.set(normalized, existing);
    }
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

    // Early exit if not Arabic
    if (!containsArabic(trimmedText)) {
      return this.noMatch(normalizedInput);
    }

    // Step 1: Try exact match (with diacritics)
    const exactMatch = this.findExactMatch(trimmedText);
    if (exactMatch) {
      return this.createResult(exactMatch, 'exact', normalizedInput);
    }

    // Step 2: Try normalized match (without diacritics)
    const normalizedMatches = this.normalizedVerseMap.get(normalizedInput);

    if (normalizedMatches && normalizedMatches.length > 0) {
      // Return first match with suggestions if multiple
      const primary = normalizedMatches[0];
      const result = this.createResult(primary, 'normalized', normalizedInput);

      // Add suggestions if multiple matches
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

    // Check for normalized match
    if (normalizedInput === expectedNormalized) {
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
    const mismatchIndex = this.findMismatchIndex(normalizedInput, expectedNormalized);

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
    return this.verses.find((v) => v.surah === surah && v.ayah === ayah);
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
    const normalizedQuery = normalizeArabic(query);
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

  // Private helper methods

  private findExactMatch(text: string): QuranVerse | undefined {
    return this.verses.find((v) => v.text === text);
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
