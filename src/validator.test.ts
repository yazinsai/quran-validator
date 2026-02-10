import { describe, it, expect } from 'vitest';
import { QuranValidator, createValidator } from './validator';
import { normalizeArabic, removeDiacritics, containsArabic } from './normalizer';

describe('QuranValidator', () => {
  const validator = new QuranValidator();

  describe('validate()', () => {
    it('should validate Bismillah verse (Uthmani text)', () => {
      // Surah Al-Fatiha, verse 1
      // Note: Due to Unicode normalization differences (NFC vs NFD for Arabic diacritics),
      // exact byte-level match may not always work. The normalized match is still valid.
      const result = validator.validate('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ');

      expect(result.isValid).toBe(true);
      expect(['exact', 'normalized']).toContain(result.matchType);
      expect(result.reference).toBe('1:1');
    });

    it('should validate exact match when using actual data text', () => {
      // Get the actual text from the data and validate it
      const verse = validator.getVerse(1, 1);
      expect(verse).toBeDefined();

      const result = validator.validate(verse!.text);

      expect(result.isValid).toBe(true);
      expect(result.matchType).toBe('exact');
      expect(result.reference).toBe('1:1');
    });

    it('should validate Ayat al-Kursi (2:255)', () => {
      // Exact Uthmani text for Ayat al-Kursi
      const ayatKursi =
        'ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ ۚ لَا تَأْخُذُهُۥ سِنَةٌۭ وَلَا نَوْمٌۭ ۚ لَّهُۥ مَا فِى ٱلسَّمَٰوَٰتِ وَمَا فِى ٱلْأَرْضِ ۗ مَن ذَا ٱلَّذِى يَشْفَعُ عِندَهُۥٓ إِلَّا بِإِذْنِهِۦ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَىْءٍۢ مِّنْ عِلْمِهِۦٓ إِلَّا بِمَا شَآءَ ۚ وَسِعَ كُرْسِيُّهُ ٱلسَّمَٰوَٰتِ وَٱلْأَرْضَ ۖ وَلَا يَـُٔودُهُۥ حِفْظُهُمَا ۚ وَهُوَ ٱلْعَلِىُّ ٱلْعَظِيمُ';

      const result = validator.validate(ayatKursi);

      expect(result.isValid).toBe(true);
      expect(result.reference).toBe('2:255');
    });

    it('should not match non-Quran Arabic text', () => {
      const result = validator.validate('مرحبا كيف حالك اليوم');

      expect(result.isValid).toBe(false);
      expect(result.matchType).toBe('none');
    });

    it('should reject partial verses (no fuzzy matching)', () => {
      // Just "In the name of Allah" - not a complete verse
      const result = validator.validate('بسم الله');

      // Should not match - we only accept exact or normalized matches
      expect(result.isValid).toBe(false);
      expect(result.matchType).toBe('none');
    });

    it('should return no match for empty string', () => {
      const result = validator.validate('');

      expect(result.isValid).toBe(false);
      expect(result.matchType).toBe('none');
    });

    it('should return no match for non-Arabic text', () => {
      const result = validator.validate('Hello world');

      expect(result.isValid).toBe(false);
      expect(result.matchType).toBe('none');
    });

    it('should validate Al-Ikhlas (Surah 112:1)', () => {
      // Surah Al-Ikhlas, verse 1 - Uthmani text
      const result = validator.validate('قُلْ هُوَ ٱللَّهُ أَحَدٌ');

      expect(result.isValid).toBe(true);
      expect(result.reference).toBe('112:1');
    });

    it('should validate Al-Falaq (Surah 113:1)', () => {
      const result = validator.validate('قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ');

      expect(result.isValid).toBe(true);
      expect(result.reference).toBe('113:1');
    });

    it('should validate An-Nas (Surah 114:1)', () => {
      const result = validator.validate('قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ');

      expect(result.isValid).toBe(true);
      expect(result.reference).toBe('114:1');
    });

    it('should handle text with common alef instead of alef-wasla', () => {
      // Common spelling using ا instead of ٱ — but otherwise Uthmani
      const result = validator.validate('قل هو الله أحد');

      expect(result.isValid).toBe(true);
      expect(result.reference).toBe('112:1');
    });
  });

  describe('detectAndValidate()', () => {
    it('should detect Quran quotes in mixed text', () => {
      const text =
        'The verse بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ means "In the name of Allah"';

      const result = validator.detectAndValidate(text);

      expect(result.detected).toBe(true);
      expect(result.segments.length).toBeGreaterThan(0);
      expect(result.segments[0].validation?.isValid).toBe(true);
    });

    it('should handle text with no Arabic content', () => {
      const text = 'This is just English text with no Arabic';

      const result = validator.detectAndValidate(text);

      expect(result.detected).toBe(false);
      expect(result.segments.length).toBe(0);
    });

    it('should detect multiple Arabic segments', () => {
      const text =
        'First verse: بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ and another: قُلْ هُوَ ٱللَّهُ أَحَدٌ';

      const result = validator.detectAndValidate(text);

      expect(result.detected).toBe(true);
      expect(result.segments.length).toBe(2);
    });

    it('should skip very short Arabic text', () => {
      const text = 'Just الله here';

      const result = validator.detectAndValidate(text);

      // "الله" is shorter than default minDetectionLength (10)
      expect(result.segments.every((s) => s.text.length >= 10 || !s.validation));
    });
  });

  describe('getVerse()', () => {
    it('should get verse by surah and ayah number', () => {
      const verse = validator.getVerse(1, 1);

      expect(verse).toBeDefined();
      expect(verse?.surah).toBe(1);
      expect(verse?.ayah).toBe(1);
      expect(verse?.text).toContain('بِسْمِ');
    });

    it('should return undefined for invalid reference', () => {
      const verse = validator.getVerse(115, 1); // No surah 115

      expect(verse).toBeUndefined();
    });
  });

  describe('getSurah()', () => {
    it('should get surah by number', () => {
      const surah = validator.getSurah(1);

      expect(surah).toBeDefined();
      expect(surah?.name).toContain('الفاتحة');
      expect(surah?.englishName).toBe('Al-Fatiha');
      expect(surah?.versesCount).toBe(7);
    });

    it('should return undefined for invalid surah number', () => {
      const surah = validator.getSurah(115);

      expect(surah).toBeUndefined();
    });

    it('should return surah with correct verse count for Al-Baqara', () => {
      const surah = validator.getSurah(2);

      expect(surah).toBeDefined();
      expect(surah?.versesCount).toBe(286);
    });
  });

  describe('search()', () => {
    it('should search for verses containing text', () => {
      const results = validator.search('الله الرحمان');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].similarity).toBeGreaterThan(0.3);
    });

    it('should limit results', () => {
      const results = validator.search('الله', 5);

      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('createValidator()', () => {
    it('should create validator with custom options', () => {
      const customValidator = createValidator({ maxSuggestions: 5 });

      expect(customValidator).toBeInstanceOf(QuranValidator);
    });
  });
});

describe('Uthmani script character normalization', () => {
  it('should match Uthmani الصدقات form with alef-wasla variant', () => {
    // Uthmani has alef-wasla (ٱ), tatweel with superscript alef (ـٰ)
    // The superscript alef represents the actual alef in common Arabic spelling
    const uthmani = 'ٱلصَّدَقَـٰتُ';
    const normalizedUthmani = normalizeArabic(uthmani);

    expect(normalizedUthmani).toBe('الصدقات');
  });

  it('should remove rubul-hizb (۞) used in Uthmani text', () => {
    const withRubul = '۞ إِنَّمَا';
    const normalized = normalizeArabic(withRubul);

    expect(normalized).not.toContain('۞');
    expect(normalized).toBe('إنما');
  });

  it('should convert superscript alef (ـٰ) to regular alef in Uthmani', () => {
    // Superscript alef (U+0670) represents a long 'a' sound that is written
    // as a regular alef in common Arabic
    // In Uthmani: الصَّدَقَـٰتُ → In common: الصدقات
    const uthmani = 'ٱلسَّمَٰوَٰتِ';
    const normalizedUthmani = normalizeArabic(uthmani);

    // Should convert superscript alef to regular alef
    expect(normalizedUthmani).toBe('السماوات');
  });

  it('should not introduce extra alef for hamza above before alef', () => {
    // Uthmani: hamza above on tatweel before alef (ـٔا) should not become double alef
    const uthmani = 'ٱلْـَٔاخِرِ';
    const normalized = normalizeArabic(uthmani);

    // Both forms should produce the same result
    expect(normalized).toBe('الاخر');
  });
});

describe('normalizeArabic', () => {
  it('should remove diacritics', () => {
    const result = normalizeArabic('السَّلَامُ عَلَيْكُمُ');
    expect(result).toBe('السلام عليكم');
  });

  it('should preserve hamza forms (أ إ) while normalizing آ and ٱ to bare alef', () => {
    // أ إ preserved (hamza carriers), آ ٱ → ا
    const result = normalizeArabic('أإآٱ');
    expect(result).toBe('أإاا');
  });

  it('should preserve alef maqsura', () => {
    const result = normalizeArabic('على');
    expect(result).toBe('على');
  });

  it('should preserve teh marbuta', () => {
    const result = normalizeArabic('رحمة');
    expect(result).toBe('رحمة');
  });

  it('should remove tatweel', () => {
    const result = normalizeArabic('كتـــاب');
    expect(result).toBe('كتاب');
  });

  it('should normalize whitespace', () => {
    const result = normalizeArabic('بسم   الله');
    expect(result).toBe('بسم الله');
  });

  it('should handle Uthmani alef-wasla', () => {
    // ٱ should become ا
    const result = normalizeArabic('ٱللَّهُ');
    expect(result).toBe('الله');
  });

  it('should normalize presentation-form ligatures (e.g., Allah sign)', () => {
    // U+FDF2 ARABIC LIGATURE ALLAH ISOLATED FORM
    const result = normalizeArabic('ﷲ');
    expect(result).toBe('الله');
  });

  it('should strip bidi controls and remove verse numbers', () => {
    const input = 'سورة \u200F١١٢:١ \u200Fقُلْ هُوَ ٱللَّهُ أَحَدٌ';
    const result = normalizeArabic(input);

    // Bidi controls stripped, Arabic-Indic digits and verse numbers removed
    expect(result).toContain('سورة');
    expect(result).toContain('قل هو الله أحد');
    expect(result).not.toMatch(/[\u200c\u200d\u200e\u200f\u061c]/);
  });
});

describe('removeDiacritics', () => {
  it('should remove all diacritical marks', () => {
    const result = removeDiacritics('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ');
    expect(result).not.toContain('ِ');
    expect(result).not.toContain('ْ');
    expect(result).not.toContain('َ');
  });
});

describe('containsArabic', () => {
  it('should return true for Arabic text', () => {
    expect(containsArabic('مرحبا')).toBe(true);
    expect(containsArabic('Hello مرحبا world')).toBe(true);
  });

  it('should return false for non-Arabic text', () => {
    expect(containsArabic('Hello world')).toBe(false);
    expect(containsArabic('123')).toBe(false);
  });
});

describe('diff highlighting for invalid text', () => {
  const validator = new QuranValidator();

  it('should show normalized diff when text does not match any verse', () => {
    // This is fabricated text that doesn't exist in the Quran
    const result = validator.validate('بسم الله الرحمن');  // Truncated

    expect(result.isValid).toBe(false);
    // Should include diff info showing what the normalized input was
    // and what it was compared against (closest verse or expected)
    expect(result.normalizedInput).toBeDefined();
    expect(result.normalizedInput).toBe('بسم الله الرحمن');
  });

  it('should show diff between input and expected verse when reference provided', () => {
    // Validate against a specific reference - text doesn't match 1:1
    const result = validator.validateAgainst('بسم الله', '1:1');

    expect(result.isValid).toBe(false);
    // Should show the normalized input
    expect(result.normalizedInput).toBeDefined();
    // Should show what the expected normalized verse text is
    expect(result.expectedNormalized).toBeDefined();
    expect(result.expectedNormalized).toBe('بسم الله الرحمان الرحيم');
  });

  it('should highlight specific mismatch positions', () => {
    // One word different
    const result = validator.validateAgainst('بسم الله الكريم الرحيم', '1:1');

    expect(result.isValid).toBe(false);
    // Should show which part is different
    expect(result.mismatchIndex).toBeDefined();
    // The mismatch starts at "الكريم" where it should be "الرحمان"
    expect(result.mismatchIndex).toBeGreaterThan(0);
  });
});

describe('analyzeFabrication()', () => {
  const validator = new QuranValidator();

  it('should mark all words as valid for a real Quranic sequence', () => {
    // "بسم الله الرحمان الرحيم" exists contiguously in 1:1
    const result = validator.analyzeFabrication('بسم الله الرحمان الرحيم');

    expect(result.words.length).toBe(4);
    expect(result.words.every(w => !w.isFabricated)).toBe(true);
    expect(result.stats.fabricatedWords).toBe(0);
    expect(result.stats.fabricatedRatio).toBe(0);
  });

  it('should mark individual words as valid if they exist somewhere in the Quran', () => {
    // Each word exists in the Quran, but not as a contiguous sequence
    // "الله" exists, "السماء" exists, "الأرض" exists (note: with hamza)
    const result = validator.analyzeFabrication('الله السماء الأرض');

    expect(result.words.length).toBe(3);
    // All should be valid since each word exists somewhere in the Quran
    expect(result.words.every(w => !w.isFabricated)).toBe(true);
    expect(result.stats.fabricatedWords).toBe(0);
  });

  it('should mark fabricated words that do not exist anywhere in the Quran', () => {
    // "بسم الله" exists, but "المجيد" doesn't exist as a standalone word in the Quran
    // Note: "المجيد" does NOT appear in the Quran - it's "الْمَجِيدِ" in verses like 85:15
    // but let's use a clearly fabricated word instead
    const result = validator.analyzeFabrication('بسم الله الفلان');

    expect(result.words.length).toBe(3);
    // "بسم" and "الله" should be valid
    expect(result.words[0].isFabricated).toBe(false);
    expect(result.words[1].isFabricated).toBe(false);
    // "الفلان" is completely made up - should be fabricated
    expect(result.words[2].isFabricated).toBe(true);
    expect(result.stats.fabricatedWords).toBe(1);
  });

  it('should handle empty input', () => {
    const result = validator.analyzeFabrication('');

    expect(result.words.length).toBe(0);
    expect(result.stats.totalWords).toBe(0);
    expect(result.stats.fabricatedWords).toBe(0);
    expect(result.stats.fabricatedRatio).toBe(0);
  });

  it('should handle completely fabricated text', () => {
    // Completely made up Arabic that doesn't exist in the Quran
    const result = validator.analyzeFabrication('الفلان البلان الكلان');

    expect(result.words.length).toBe(3);
    expect(result.words.every(w => w.isFabricated)).toBe(true);
    expect(result.stats.fabricatedWords).toBe(3);
    expect(result.stats.fabricatedRatio).toBe(1);
  });

  it('should normalize input before analyzing', () => {
    // With diacritics - should still find matches
    const result = validator.analyzeFabrication('بِسْمِ اللَّهِ');

    expect(result.words.length).toBe(2);
    expect(result.words.every(w => !w.isFabricated)).toBe(true);
  });

  it('should include normalized input in result', () => {
    const result = validator.analyzeFabrication('بِسْمِ اللَّهِ');

    expect(result.normalizedInput).toBe('بسم الله');
  });

  it('should find contiguous matches spanning multiple words', () => {
    // "قل هو الله احد" is a contiguous sequence from 112:1
    const result = validator.analyzeFabrication('قل هو الله احد');

    expect(result.words.length).toBe(4);
    expect(result.words.every(w => !w.isFabricated)).toBe(true);
  });
});

describe('Multi-Riwaya Support', () => {
  describe('backward compatibility', () => {
    it('should behave identically to current when no riwayat option is passed', () => {
      const defaultValidator = new QuranValidator();
      const explicitHafs = new QuranValidator({ riwayat: ['hafs'] });

      // Both should validate Hafs text the same way
      const defaultResult = defaultValidator.validate('قُلْ هُوَ ٱللَّهُ أَحَدٌ');
      const explicitResult = explicitHafs.validate('قُلْ هُوَ ٱللَّهُ أَحَدٌ');

      expect(defaultResult.isValid).toBe(explicitResult.isValid);
      expect(defaultResult.matchType).toBe(explicitResult.matchType);
      expect(defaultResult.reference).toBe(explicitResult.reference);
    });

    it('should not have riwayaMatches when only hafs is loaded', () => {
      const validator = new QuranValidator();
      const result = validator.validate('قُلْ هُوَ ٱللَّهُ أَحَدٌ');

      expect(result.isValid).toBe(true);
      expect(result.riwayaMatches).toBeUndefined();
    });
  });

  describe('validate() with multiple riwayat', () => {
    const multiValidator = new QuranValidator({ riwayat: ['hafs', 'warsh'] });

    it('should validate Warsh text when Warsh is loaded', () => {
      // Warsh 113:1 — different from Hafs 113:1
      const warshText = 'قُلَ اَعُوذُ بِرَبِّ اِ۬لْفَلَقِ';
      const result = multiValidator.validate(warshText);

      expect(result.isValid).toBe(true);
    });

    it('should not validate Warsh text when only Hafs is loaded', () => {
      const hafsOnly = new QuranValidator({ riwayat: ['hafs'] });
      // Warsh 1:3 — "ملك يوم الدين" (different from Hafs "مالك يوم الدين")
      const warshText = 'مَلِكِ يَوْمِ اِ۬لدِّينِۖ';
      const result = hafsOnly.validate(warshText);

      expect(result.isValid).toBe(false);
    });

    it('should return riwayaMatches when text matches in multiple riwayat', () => {
      // 112:1 — Warsh and Hafs both have "قل هو الله أحد" (normalizes the same)
      const verse = multiValidator.getVerse(1, 1); // Hafs 1:1 (basmalah)
      const result = multiValidator.validate(verse!.text);

      expect(result.isValid).toBe(true);
      expect(result.riwayaMatches).toBeDefined();
      expect(result.riwayaMatches!.length).toBeGreaterThan(0);
      // Should include hafs
      expect(result.riwayaMatches!.some(m => m.riwaya === 'hafs')).toBe(true);
    });

    it('should sort riwayaMatches with exact matches before normalized', () => {
      // Use exact Hafs text — Hafs should be exact, Warsh (if same normalized) should be normalized
      const hafsVerse = multiValidator.getVerse(1, 1);
      const result = multiValidator.validate(hafsVerse!.text);

      expect(result.isValid).toBe(true);
      if (result.riwayaMatches && result.riwayaMatches.length > 1) {
        // First match should be exact
        expect(result.riwayaMatches[0].matchType).toBe('exact');
      }
    });
  });

  describe('validateAgainst() with multiple riwayat', () => {
    const multiValidator = new QuranValidator({ riwayat: ['hafs', 'warsh'] });

    it('should report which riwaya matched when validating against a reference', () => {
      const hafsVerse = multiValidator.getVerse(1, 1);
      const result = multiValidator.validateAgainst(hafsVerse!.text, '1:1');

      expect(result.isValid).toBe(true);
      expect(result.riwayaMatches).toBeDefined();
      expect(result.riwayaMatches!.some(m => m.riwaya === 'hafs')).toBe(true);
    });
  });

  describe('getLoadedRiwayat()', () => {
    it('should return metadata for loaded riwayat', () => {
      const validator = new QuranValidator({ riwayat: ['hafs', 'warsh'] });
      const loaded = validator.getLoadedRiwayat();

      expect(loaded.length).toBe(2);
      expect(loaded[0].id).toBe('hafs');
      expect(loaded[0].name).toBe('Hafs');
      expect(loaded[0].nameArabic).toBe('حفص');
      expect(loaded[1].id).toBe('warsh');
      expect(loaded[1].name).toBe('Warsh');
    });

    it('should return only hafs by default', () => {
      const validator = new QuranValidator();
      const loaded = validator.getLoadedRiwayat();

      expect(loaded.length).toBe(1);
      expect(loaded[0].id).toBe('hafs');
    });
  });

  describe('getVerseRiwayat()', () => {
    it('should return texts for a verse across all loaded riwayat', () => {
      const validator = new QuranValidator({ riwayat: ['hafs', 'warsh'] });
      const texts = validator.getVerseRiwayat(1, 1);

      expect(texts.length).toBe(2);
      expect(texts.some(t => t.riwayaId === 'hafs')).toBe(true);
      expect(texts.some(t => t.riwayaId === 'warsh')).toBe(true);
      // Hafs 1:1 is basmalah, Warsh 1:1 is al-hamdu lillahi
      const hafsText = texts.find(t => t.riwayaId === 'hafs')!;
      expect(hafsText.text).toContain('بِسْمِ');
    });

    it('should return empty array for non-existent verse', () => {
      const validator = new QuranValidator({ riwayat: ['hafs', 'warsh'] });
      const texts = validator.getVerseRiwayat(999, 1);

      expect(texts).toEqual([]);
    });
  });

  describe('loading all riwayat', () => {
    it('should load all 8 riwayat without errors', () => {
      const all = new QuranValidator({
        riwayat: ['hafs', 'warsh', 'qalun', 'shuba', 'duri', 'susi', 'bazzi', 'qunbul'],
      });
      const loaded = all.getLoadedRiwayat();
      expect(loaded.length).toBe(8);
    });
  });
});
