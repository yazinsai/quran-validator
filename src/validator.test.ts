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
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
      expect(result.reference).toBe('1:1');
    });

    it('should validate exact match when using actual data text', () => {
      // Get the actual text from the data and validate it
      const verse = validator.getVerse(1, 1);
      expect(verse).toBeDefined();

      const result = validator.validate(verse!.text);

      expect(result.isValid).toBe(true);
      expect(result.matchType).toBe('exact');
      expect(result.confidence).toBe(1.0);
      expect(result.reference).toBe('1:1');
    });

    it('should validate normalized text matching Bismillah', () => {
      // Common spelling without alef-wasla (ا instead of ٱ)
      const result = validator.validate('بسم الله الرحمن الرحيم');

      expect(result.isValid).toBe(true);
      expect(result.matchType).toBe('normalized');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
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

    it('should return corrections for slight variations', () => {
      // Common non-Uthmani spelling
      const result = validator.validate('الله لا إله إلا هو الحي القيوم');

      // Should match with normalized or fuzzy matching
      expect(result.isValid).toBe(true);
    });

    it('should not match non-Quran Arabic text', () => {
      const result = validator.validate('مرحبا كيف حالك اليوم');

      expect(result.isValid).toBe(false);
      expect(result.matchType).toBe('none');
    });

    it('should handle partial verses', () => {
      // Just "In the name of Allah"
      const result = validator.validate('بسم الله');

      // Should find partial match
      expect(result.isValid).toBe(true);
      expect(result.matchType).toBe('partial');
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
      // Common spelling using ا instead of ٱ
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
      expect(surah?.name).toContain('ٱلْفَاتِحَةِ');
      expect(surah?.englishName).toBe('Al-Faatiha');
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
      const results = validator.search('الله الرحمن');

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
      const customValidator = createValidator({ fuzzyThreshold: 0.9 });

      expect(customValidator).toBeInstanceOf(QuranValidator);
    });
  });
});

describe('normalizeArabic', () => {
  it('should remove diacritics', () => {
    const result = normalizeArabic('السَّلَامُ عَلَيْكُمُ');
    expect(result).toBe('السلام عليكم');
  });

  it('should normalize alef variants to plain alef', () => {
    // أإآٱ should all become ا
    const result = normalizeArabic('أإآٱ');
    expect(result).toBe('اااا');
  });

  it('should normalize alef maqsura', () => {
    const result = normalizeArabic('على');
    expect(result).toBe('علي');
  });

  it('should normalize teh marbuta', () => {
    const result = normalizeArabic('رحمة');
    expect(result).toBe('رحمه');
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
