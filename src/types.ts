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
  | 'partial'    // Input is part of a verse or verse is part of input
  | 'fuzzy'      // Similar but not exact match
  | 'none';      // No match found

/**
 * Result of validating a potential Quran quote
 */
export interface ValidationResult {
  /** Whether a valid Quran verse was found */
  isValid: boolean;
  /** Type of match found */
  matchType: MatchType;
  /** Confidence score (0-1), higher is better */
  confidence: number;
  /** The matched verse (if found) */
  matchedVerse?: QuranVerse;
  /** Reference string like "2:255" */
  reference?: string;
  /** Specific differences between input and matched verse (for corrections) */
  differences?: {
    /** What was provided */
    input: string;
    /** What it should be */
    correct: string;
    /** Position in text where difference starts */
    position: number;
  }[];
  /** Suggestions if multiple possible matches exist */
  suggestions?: {
    verse: QuranVerse;
    confidence: number;
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
  /** Minimum confidence threshold for fuzzy matches (default: 0.8) */
  fuzzyThreshold?: number;
  /** Maximum number of suggestions to return (default: 3) */
  maxSuggestions?: number;
  /** Whether to include partial matches (default: true) */
  includePartial?: boolean;
  /** Minimum text length to consider for detection (default: 10) */
  minDetectionLength?: number;
}

/**
 * Configuration for Arabic text normalization
 */
export interface NormalizationOptions {
  /** Remove diacritics/tashkeel (default: true) */
  removeDiacritics?: boolean;
  /** Normalize alef variants to plain alef (default: true) */
  normalizeAlef?: boolean;
  /** Normalize alef maqsura to ya (default: true) */
  normalizeAlefMaqsura?: boolean;
  /** Normalize teh marbuta to heh (default: true) */
  normalizeTehMarbuta?: boolean;
  /** Remove tatweel/kashida (default: true) */
  removeTatweel?: boolean;
  /** Normalize hamza carriers (default: true) */
  normalizeHamza?: boolean;
  /** Normalize whitespace (default: true) */
  normalizeWhitespace?: boolean;
}
