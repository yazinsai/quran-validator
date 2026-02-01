/**
 * quran-validator
 *
 * Validate and verify Quranic verses in LLM-generated text with 100% accuracy.
 *
 * @packageDocumentation
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
 * console.log(result.confidence); // 1.0
 *
 * // Detect and validate all Quran quotes in LLM output
 * const detection = validator.detectAndValidate(llmOutput);
 * for (const segment of detection.segments) {
 *   if (segment.validation?.isValid) {
 *     console.log(`Valid: ${segment.validation.reference}`);
 *   } else {
 *     console.log(`Invalid or not a Quran verse`);
 *   }
 * }
 * ```
 */

// Main validator
export { QuranValidator, createValidator } from './validator';

// Normalization utilities
export {
  normalizeArabic,
  removeDiacritics,
  containsArabic,
  extractArabicSegments,
  calculateSimilarity,
  findDifferences,
} from './normalizer';

// Types
export type {
  QuranVerse,
  QuranSurah,
  ValidationResult,
  DetectionResult,
  ValidatorOptions,
  MatchType,
  NormalizationOptions,
} from './types';
