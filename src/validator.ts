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
  calculateSimilarity,
  findDifferences,
} from './normalizer';

// Import bundled data
import versesData from '../data/quran-verses.min.json';
import surahsData from '../data/quran-surahs.min.json';

/**
 * Default validator options
 */
const DEFAULT_OPTIONS: Required<ValidatorOptions> = {
  fuzzyThreshold: 0.8,
  maxSuggestions: 3,
  includePartial: true,
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

    // Early exit if not Arabic
    if (!containsArabic(trimmedText)) {
      return this.noMatch();
    }

    // Step 1: Try exact match (with diacritics)
    const exactMatch = this.findExactMatch(trimmedText);
    if (exactMatch) {
      return this.createResult(exactMatch, 'exact', 1.0);
    }

    // Step 2: Try normalized match (without diacritics)
    const normalizedInput = normalizeArabic(trimmedText);
    const normalizedMatches = this.normalizedVerseMap.get(normalizedInput);

    if (normalizedMatches && normalizedMatches.length > 0) {
      // Return first match with suggestions if multiple
      const primary = normalizedMatches[0];
      const result = this.createResult(primary, 'normalized', 0.95);

      // Add differences for correction
      result.differences = findDifferences(trimmedText, primary.text);

      // Add suggestions if multiple matches
      if (normalizedMatches.length > 1) {
        result.suggestions = normalizedMatches
          .slice(0, this.options.maxSuggestions)
          .map((v) => ({
            verse: v,
            confidence: 0.95,
            reference: `${v.surah}:${v.ayah}`,
          }));
      }

      return result;
    }

    // Step 3: Try partial match (substring)
    if (this.options.includePartial) {
      const partialMatch = this.findPartialMatch(normalizedInput);
      if (partialMatch) {
        const result = this.createResult(
          partialMatch.verse,
          'partial',
          partialMatch.confidence
        );
        result.differences = findDifferences(trimmedText, partialMatch.verse.text);
        return result;
      }
    }

    // Step 4: Try fuzzy match
    const fuzzyMatch = this.findFuzzyMatch(normalizedInput);
    if (fuzzyMatch && fuzzyMatch.confidence >= this.options.fuzzyThreshold) {
      const result = this.createResult(
        fuzzyMatch.verse,
        'fuzzy',
        fuzzyMatch.confidence
      );
      result.differences = findDifferences(trimmedText, fuzzyMatch.verse.text);
      result.suggestions = fuzzyMatch.suggestions;
      return result;
    }

    // No match found
    return this.noMatch();
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

    // A detection is positive if we found any Arabic text (even if not Quran)
    const detected = validatedSegments.some(
      (seg) => seg.validation.isValid || seg.validation.matchType === 'fuzzy'
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
   * Search verses by text
   *
   * @param query - Search query (Arabic text)
   * @param limit - Maximum results to return
   * @returns Matching verses with similarity scores
   */
  search(
    query: string,
    limit: number = 10
  ): { verse: QuranVerse; similarity: number }[] {
    const normalizedQuery = normalizeArabic(query);

    const results = this.verses
      .map((verse) => ({
        verse,
        similarity: this.calculateVerseMatch(normalizedQuery, verse),
      }))
      .filter((r) => r.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return results;
  }

  // Private helper methods

  private findExactMatch(text: string): QuranVerse | undefined {
    return this.verses.find((v) => v.text === text);
  }

  private findPartialMatch(
    normalizedInput: string
  ): { verse: QuranVerse; confidence: number } | undefined {
    // Look for verses where input is a substring or vice versa
    for (const verse of this.verses) {
      const normalizedVerse = normalizeArabic(verse.text);

      // Input is contained in verse
      if (normalizedVerse.includes(normalizedInput)) {
        const ratio = normalizedInput.length / normalizedVerse.length;
        return { verse, confidence: 0.7 + ratio * 0.2 };
      }

      // Verse is contained in input
      if (normalizedInput.includes(normalizedVerse)) {
        const ratio = normalizedVerse.length / normalizedInput.length;
        return { verse, confidence: 0.6 + ratio * 0.2 };
      }
    }

    return undefined;
  }

  private findFuzzyMatch(normalizedInput: string): {
    verse: QuranVerse;
    confidence: number;
    suggestions: { verse: QuranVerse; confidence: number; reference: string }[];
  } | undefined {
    const matches: { verse: QuranVerse; similarity: number }[] = [];

    for (const verse of this.verses) {
      const similarity = this.calculateVerseMatch(normalizedInput, verse);

      if (similarity >= this.options.fuzzyThreshold * 0.9) {
        matches.push({ verse, similarity });
      }
    }

    if (matches.length === 0) {
      return undefined;
    }

    // Sort by similarity
    matches.sort((a, b) => b.similarity - a.similarity);

    const best = matches[0];
    const suggestions = matches.slice(0, this.options.maxSuggestions).map((m) => ({
      verse: m.verse,
      confidence: m.similarity,
      reference: `${m.verse.surah}:${m.verse.ayah}`,
    }));

    return {
      verse: best.verse,
      confidence: best.similarity,
      suggestions,
    };
  }

  private calculateVerseMatch(
    normalizedInput: string,
    verse: QuranVerse
  ): number {
    const normalizedVerse = normalizeArabic(verse.text);
    return calculateSimilarity(normalizedInput, normalizedVerse);
  }

  private createResult(
    verse: QuranVerse,
    matchType: MatchType,
    confidence: number
  ): ValidationResult {
    return {
      isValid: true,
      matchType,
      confidence,
      matchedVerse: verse,
      reference: `${verse.surah}:${verse.ayah}`,
    };
  }

  private noMatch(): ValidationResult {
    return {
      isValid: false,
      matchType: 'none',
      confidence: 0,
    };
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
 * const validator = createValidator({ fuzzyThreshold: 0.85 });
 * ```
 */
export function createValidator(options?: ValidatorOptions): QuranValidator {
  return new QuranValidator(options);
}
