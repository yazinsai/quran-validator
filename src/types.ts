/**
 * Represents a single verse (ayah) from the Quran
 */
export interface QuranVerse {
  /** Sequential verse number (1-6236) */
  id: number;
  /** Surah (chapter) number (1-114) */
  surah: number;
  /** Ayah (verse) number within the surah */
  ayah: number;
  /** Full Arabic text with diacritics (Uthmani script) */
  text: string;
  /** Simplified Arabic text without diacritics */
  textSimple: string;
  /** Page number in standard Uthmani mushaf */
  page: number;
  /** Juz (part) number (1-30) */
  juz: number;
}

/**
 * Represents a Surah (chapter) of the Quran
 */
export interface QuranSurah {
  /** Surah number (1-114) */
  number: number;
  /** Arabic name of the surah */
  name: string;
  /** English name of the surah */
  englishName: string;
  /** Number of verses in this surah */
  versesCount: number;
  /** Revelation type: 'Meccan' or 'Medinan' */
  revelationType: 'Meccan' | 'Medinan';
}

/**
 * Type of match found during validation
 */
export type MatchType =
  | 'exact'      // Perfect character-by-character match with diacritics
  | 'normalized' // Match after removing diacritics
  | 'none';      // No match found

/**
 * Result of validating a potential Quran quote
 */
export interface ValidationResult {
  /** Whether a valid Quran verse was found */
  isValid: boolean;
  /** Type of match found */
  matchType: MatchType;
  /** The matched verse (if found) */
  matchedVerse?: QuranVerse;
  /** Reference string like "2:255" */
  reference?: string;
  /** The normalized (stripped) input text that was checked */
  normalizedInput?: string;
  /** The expected normalized verse text (for comparison when invalid) */
  expectedNormalized?: string;
  /** Character index where the mismatch starts (-1 if no mismatch or different lengths) */
  mismatchIndex?: number;
  /** Suggestions if multiple possible matches exist */
  suggestions?: {
    verse: QuranVerse;
    reference: string;
  }[];
}

/**
 * Detection result for finding Quran quotes in text
 */
export interface DetectionResult {
  /** Whether potential Quran content was detected */
  detected: boolean;
  /** Extracted segments that appear to be Quran quotes */
  segments: {
    /** The detected text */
    text: string;
    /** Start position in original text */
    startIndex: number;
    /** End position in original text */
    endIndex: number;
    /** Validation result for this segment */
    validation?: ValidationResult;
  }[];
}

/**
 * Options for the validator
 */
export interface ValidatorOptions {
  /** Maximum number of suggestions to return (default: 3) */
  maxSuggestions?: number;
  /** Minimum text length to consider for detection (default: 10) */
  minDetectionLength?: number;
}

