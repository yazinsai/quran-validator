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
  /** All matching riwayat, best match first (only present when multiple riwayat loaded) */
  riwayaMatches?: RiwayaMatch[];
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
 * Supported riwaya identifiers
 */
export type RiwayaId = 'hafs' | 'warsh' | 'qalun' | 'shuba' | 'duri' | 'susi' | 'bazzi' | 'qunbul';

/**
 * Metadata about a riwaya (transmission of Quran recitation)
 */
export interface RiwayaInfo {
  id: RiwayaId;
  name: string;
  nameArabic: string;
  qari: string;
  qariArabic: string;
}

/**
 * A match from a specific riwaya
 */
export interface RiwayaMatch {
  riwaya: RiwayaId;
  matchType: MatchType;
  verse: QuranVerse;
  riwayaText: string;
}

/**
 * Options for the validator
 */
export interface ValidatorOptions {
  /** Maximum number of suggestions to return (default: 3) */
  maxSuggestions?: number;
  /** Minimum text length to consider for detection (default: 10) */
  minDetectionLength?: number;
  /** Which riwayat to load (default: ['hafs']) */
  riwayat?: RiwayaId[];
}

/**
 * Analysis of word-level fabrication in text
 */
export interface FabricationAnalysis {
  /** The normalized text that was analyzed */
  normalizedInput: string;
  /** Word-by-word breakdown */
  words: WordAnalysis[];
  /** Summary stats */
  stats: {
    totalWords: number;
    fabricatedWords: number;
    /** Ratio of fabricated words (0-1) */
    fabricatedRatio: number;
  };
}

/**
 * Analysis of a single word
 */
export interface WordAnalysis {
  /** The normalized word */
  word: string;
  /** True if this word doesn't exist anywhere in the Quran */
  isFabricated: boolean;
}

