import { describe, it, expect } from 'vitest';
import {
  LLMProcessor,
  createLLMProcessor,
  quickValidate,
  SYSTEM_PROMPTS,
} from './llm-integration';

describe('LLMProcessor', () => {
  const processor = new LLMProcessor();

  describe('process() with tagged quotes', () => {
    it('should validate XML-tagged Quran quotes', () => {
      const text = `
        The first verse of the Quran is:
        <quran ref="1:1">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</quran>
        which means "In the name of Allah".
      `;

      const result = processor.process(text);

      expect(result.quotes.length).toBeGreaterThan(0);
      expect(result.quotes[0].detectionMethod).toBe('tagged');
      expect(result.quotes[0].reference).toBe('1:1');
      expect(result.quotes[0].isValid).toBe(true);
    });

    it('should detect misquoted tagged verse and keep reference', () => {
      // Intentionally wrong spelling — won't match any verse
      const text = `
        <quran ref="1:1">بسم اللة الرحمن الرحيم</quran>
      `;

      const result = processor.process(text);

      expect(result.quotes.length).toBe(1);
      // Should keep the cited reference even though text doesn't match
      expect(result.quotes[0].reference).toBe('1:1');
    });

    it('should handle inline references like "text (1:1)"', () => {
      const text = `The verse بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ (1:1) is important.`;

      const result = processor.process(text);

      expect(result.quotes.length).toBeGreaterThan(0);
      expect(result.quotes.some((q) => q.reference === '1:1')).toBe(true);
    });

    it('should ignore inline references without Arabic text', () => {
      const text = `Explanation about charity (2:215) with no Arabic quote.`;

      const result = processor.process(text);

      expect(result.quotes.length).toBe(0);
    });
  });

  describe('process() with contextual detection', () => {
    it('should detect quotes after "Allah says"', () => {
      const text = `Allah says: قُلْ هُوَ ٱللَّهُ أَحَدٌ and this verse emphasizes monotheism.`;

      const result = processor.process(text);

      expect(result.quotes.length).toBeGreaterThan(0);
      const contextualQuote = result.quotes.find(
        (q) => q.detectionMethod === 'contextual'
      );
      expect(contextualQuote).toBeDefined();
    });

    it('should detect quotes after "in the Quran"', () => {
      const text = `In the Quran: ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ which means praise be to Allah.`;

      const result = processor.process(text);

      expect(result.quotes.some((q) => q.detectionMethod === 'contextual')).toBe(
        true
      );
    });
  });

  describe('process() with untagged scanning', () => {
    it('should detect untagged exact Quran content', () => {
      // Use the exact verse text from the database
      const processor = new LLMProcessor();
      const text = `Some text here. قُلْ هُوَ ٱللَّهُ أَحَدٌ More text.`;

      const result = processor.process(text);

      // Should detect the exact verse
      expect(result.quotes.length).toBeGreaterThan(0);
      expect(result.quotes.some(q => q.reference === '112:1')).toBe(true);
    });

    it('should not flag non-Quran Arabic text', () => {
      const text = `مرحبا كيف حالك اليوم هذا نص عربي عادي`;

      const result = processor.process(text);

      // Should not have any Quran matches (no exact or normalized matches)
      expect(result.quotes.filter(q => q.isValid).length).toBe(0);
    });
  });

  describe('auto-correction', () => {
    it('should auto-correct when enabled and Uthmani quote needs minor correction', () => {
      const processor = new LLMProcessor({ autoCorrect: true });
      // Uthmani text without diacritics — should normalize-match 1:1
      const text = `<quran ref="1:1">بسم ٱلله ٱلرحمٰن ٱلرحيم</quran>`;

      const result = processor.process(text);

      expect(result.quotes.length).toBe(1);
      expect(result.quotes[0].reference).toBe('1:1');
      expect(result.quotes[0].wasCorrected || result.quotes[0].isValid).toBe(true);
    });

    it('should not auto-correct when disabled', () => {
      const processor = new LLMProcessor({ autoCorrect: false });
      const text = `<quran ref="1:1">بسم ٱلله ٱلرحمٰن ٱلرحيم</quran>`;

      const result = processor.process(text);

      // Should keep original text structure
      expect(result.correctedText).toContain('بسم ٱلله ٱلرحمٰن ٱلرحيم');
    });
  });

  describe('validateQuote()', () => {
    it('should validate a correct quote', () => {
      const result = processor.validateQuote('قُلْ هُوَ ٱللَّهُ أَحَدٌ', '112:1');

      expect(result.isValid).toBe(true);
      expect(result.actualRef).toBe('112:1');
    });

    it('should detect reference mismatch', () => {
      const result = processor.validateQuote('قُلْ هُوَ ٱللَّهُ أَحَدٌ', '1:1');

      expect(result.isValid).toBe(false);
      expect(result.actualRef).toBe('112:1');
    });
  });

  describe('getSystemPrompt()', () => {
    it('should return XML prompt by default', () => {
      const prompt = processor.getSystemPrompt();

      expect(prompt).toContain('<quran');
      expect(prompt).toContain('ref=');
    });

    it('should return markdown prompt when configured', () => {
      const mdProcessor = new LLMProcessor({ tagFormat: 'markdown' });
      const prompt = mdProcessor.getSystemPrompt();

      expect(prompt).toContain('```quran');
    });
  });
});

describe('SYSTEM_PROMPTS', () => {
  it('should have XML prompt', () => {
    expect(SYSTEM_PROMPTS.xml).toContain('<quran');
  });

  it('should have markdown prompt', () => {
    expect(SYSTEM_PROMPTS.markdown).toContain('```quran');
  });

  it('should have bracket prompt', () => {
    expect(SYSTEM_PROMPTS.bracket).toContain('[[Q:');
  });

  it('should have minimal prompt', () => {
    expect(SYSTEM_PROMPTS.minimal).toContain('parentheses');
  });
});

describe('quickValidate()', () => {
  it('should quickly validate text with Quran content', () => {
    const text = `The verse <quran ref="1:1">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</quran> is important.`;

    const result = quickValidate(text);

    expect(result.hasQuranContent).toBe(true);
  });

  it('should detect tagged Uthmani Quran content', () => {
    const text = `<quran ref="1:1">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</quran>`;

    const result = quickValidate(text);

    expect(result.hasQuranContent).toBe(true);
  });
});

describe('createLLMProcessor()', () => {
  it('should create processor with options', () => {
    const processor = createLLMProcessor({ autoCorrect: true });

    expect(processor).toBeInstanceOf(LLMProcessor);
  });
});

describe('partial/truncated verse handling', () => {
  const processor = new LLMProcessor();

  it('should reject truncated verses (no fuzzy matching)', () => {
    // 2:177 is a long verse. Truncated text should be invalid - we only accept exact/normalized matches
    const partialVerse = `<quran ref="2:177">لَّيْسَ الْبِرَّ أَن تُوَلُّوا وُجُوهَكُمْ قِبَلَ الْمَشْرِقِ وَالْمَغْرِبِ وَلَٰكِنَّ الْبِرَّ مَنْ آمَنَ بِاللَّهِ وَالْيَوْمِ الْآخِرِ وَالْمَلَائِكَةِ وَالْكِتَابِ وَالنَّبِيِّينَ وَآتَى الْمَالَ عَلَىٰ حُبِّهِۦ ذَوِي الْقُرْبَىٰ وَالْيَتَامَىٰ وَالْمَسَاكِينَ وَابْنَ السَّبِيلِ وَالسَّائِلِينَ وَفِي الرِّقَابِ</quran>`;

    const result = processor.process(partialVerse);

    expect(result.quotes.length).toBe(1);
    expect(result.quotes[0].reference).toBe('2:177');
    // Truncated verses are now invalid - must be exact or normalized match
    expect(result.quotes[0].isValid).toBe(false);
  });

  it('should reject another truncated verse (2:267)', () => {
    // First part of 2:267 - should be invalid (truncated)
    const partialVerse = `<quran ref="2:267">يَا أَيُّهَا الَّذِينَ آمَنُوا أَنفِقُوا مِن طَيِّبَاتِ مَا كَسَبْتُمْ وَمِمَّا أَخْرَجْنَا لَكُم مِّنَ الْأَرْضِ وَلَا تَيَمَّمُوا الْخَبِيثَ مِنْهُ تُنفِقُونَ</quran>`;

    const result = processor.process(partialVerse);

    expect(result.quotes.length).toBe(1);
    expect(result.quotes[0].reference).toBe('2:267');
    expect(result.quotes[0].isValid).toBe(false);
  });

  it('should reject truncated verse even with correct reference', () => {
    // Truncated 1:1 - should be invalid
    const partialWithDiacritics = `<quran ref="1:1">بِسْمِ اللَّهِ الرَّحْمَنِ</quran>`;

    const result = processor.process(partialWithDiacritics);

    expect(result.quotes.length).toBe(1);
    expect(result.quotes[0].reference).toBe('1:1');
    // Truncated verses are now rejected
    expect(result.quotes[0].isValid).toBe(false);
  });
});

describe('exact verse matching', () => {
  const processor = new LLMProcessor();

  it('should validate exact verse text with correct reference', () => {
    // Use exact Uthmani text from database for 69:34
    const verse69_34 = `<quran ref="69:34">وَلَا يَحُضُّ عَلَىٰ طَعَامِ ٱلْمِسْكِينِ</quran>`;

    const result = processor.process(verse69_34);

    expect(result.quotes.length).toBe(1);
    expect(result.quotes[0].reference).toBe('69:34');
    expect(result.quotes[0].isValid).toBe(true);
  });

  it('should validate exact verse text with wrong reference and correct it', () => {
    // 112:1 text cited as 1:1
    const wrongRef = `<quran ref="1:1">قُلْ هُوَ ٱللَّهُ أَحَدٌ</quran>`;

    const result = processor.process(wrongRef);

    expect(result.quotes.length).toBe(1);
    expect(result.quotes[0].isValid).toBe(true);
    expect(result.quotes[0].reference).toBe('112:1'); // Corrected to actual reference
    expect(result.quotes[0].wasCorrected).toBe(true);
  });

  it('should reject text that doesnt match any verse exactly or normalized', () => {
    // Text with diacritics differences that don't normalize to any verse
    const mismatchedText = `<quran ref="2:215">يَسْأَلُونَكَ مَاذَا يُنفِقُونَ قُلْ مَا أَنفَقْتُم</quran>`;

    const result = processor.process(mismatchedText);

    expect(result.quotes.length).toBe(1);
    // This truncated text doesn't exist as a complete verse - should be invalid
    expect(result.quotes[0].isValid).toBe(false);
  });
});

describe('fabricated/invalid text detection', () => {
  const processor = new LLMProcessor();

  it('should reject completely fabricated Arabic text', () => {
    // This is fake Quranic-style text that does not exist in the Quran
    const fabricatedText = `<quran ref="2:100">لا يحب الله الجبن من الإنسن ولا الفخار بالخير ومن يؤثر من شراء حسب ما بغت متاع الحيوة الدنيا كأنما هو يعيد الجروح في قلبه بهواء الله يوم يبعث ما كانوا يستخفون من شرائعهم</quran>`;

    const result = processor.process(fabricatedText);

    expect(result.quotes.length).toBe(1);
    expect(result.quotes[0].isValid).toBe(false);
    // Should include normalized diff info
    expect(result.quotes[0].normalizedInput).toBeDefined();
  });

  it('should correct text from wrong verse (112:1 text cited as 1:1)', () => {
    // Text is from Surah Al-Ikhlas (112:1) but cited as Al-Fatiha (1:1)
    // Should be recognized as real Quran and corrected to the actual reference
    const wrongVerse = `<quran ref="1:1">قُلْ هُوَ ٱللَّهُ أَحَدٌ</quran>`;

    const result = processor.process(wrongVerse);

    expect(result.quotes.length).toBe(1);
    expect(result.quotes[0].reference).toBe('112:1'); // Corrected to actual reference
    expect(result.quotes[0].isValid).toBe(true); // Text IS real Quran
    expect(result.quotes[0].wasCorrected).toBe(true);
  });

  it('should reject random Arabic words that are not Quran', () => {
    // Just random Arabic sentence, not from Quran
    const randomArabic = `<quran ref="3:50">ذهبت إلى السوق واشتريت خبزاً وحليباً ثم عدت إلى البيت</quran>`;

    const result = processor.process(randomArabic);

    expect(result.quotes.length).toBe(1);
    expect(result.quotes[0].isValid).toBe(false);
  });

  it('should correct text from a completely different surah', () => {
    // Ayat al-Kursi (2:255) cited as being from Surah Yusuf (12:1)
    // Should recognize as real Quran and correct to actual reference
    const wrongSurah = `<quran ref="12:1">ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ</quran>`;

    const result = processor.process(wrongSurah);

    expect(result.quotes.length).toBe(1);
    // Should be corrected to the actual verse (2:255 or 3:2 - both start similarly)
    expect(result.quotes[0].isValid).toBe(true);
    expect(result.quotes[0].wasCorrected).toBe(true);
  });

  it('should reject very short generic phrases that are not complete verses', () => {
    // "بسم الله" alone is not a complete verse
    const tooShort = `<quran ref="1:1">بسم الله</quran>`;

    const result = processor.process(tooShort);

    expect(result.quotes.length).toBe(1);
    // Short text that's not a complete verse should be invalid
    expect(result.quotes[0].isValid).toBe(false);
    // Should show what was expected
    expect(result.quotes[0].expectedNormalized).toBeDefined();
  });
});

describe('Uthmani script normalization (regression tests)', () => {
  const processor = new LLMProcessor();

  // These tests verify that Uthmani text (what LLMs should output)
  // matches the Uthmani script in the database after normalization.

  it('should validate 51:19 with Uthmani text', () => {
    const text = `<quran ref="51:19">وَفِىٓ أَمْوَٰلِهِمْ حَقٌّ لِّلسَّآئِلِ وَٱلْمَحْرُومِ</quran>`;

    const result = processor.process(text);

    expect(result.quotes.length).toBe(1);
    expect(result.quotes[0].reference).toBe('51:19');
    expect(result.quotes[0].isValid).toBe(true);
  });

  it('should validate 112:1 with Uthmani text sans diacritics', () => {
    // Uthmani text without diacritics — should still normalize-match
    const text = `<quran ref="112:1">قل هو ٱلله أحد</quran>`;

    const result = processor.process(text);

    expect(result.quotes.length).toBe(1);
    expect(result.quotes[0].reference).toBe('112:1');
    expect(result.quotes[0].isValid).toBe(true);
  });

  it('should handle hamza above (ٔ) in Uthmani — truncated text is still invalid', () => {
    // Uthmani text from 2:215 (truncated)
    const modelOutput = `<quran ref="2:215">يَسْـَٔلُونَكَ مَاذَا يُنفِقُونَ</quran>`;

    const result = processor.process(modelOutput);

    expect(result.quotes.length).toBe(1);
    // Truncated — should be invalid
    expect(result.quotes[0].normalizedInput).toBeDefined();
  });
});

describe('tagged quote reference handling (regression tests)', () => {
  const processor = new LLMProcessor();

  it('should use the tagged reference, not a fuzzy search result', () => {
    // This is the exact bug we fixed: when ref="2:177" is tagged,
    // the processor was returning ref="2:1" from a fuzzy search instead
    const text = `<quran ref="2:177">لَيْسَ الْبِرَّ أَنْ تُوَلُّوا وُجُوهَكُمْ قِبَلَ الْمَشْرِقِ وَالْمَغْرِبِ</quran>`;

    const result = processor.process(text);

    expect(result.quotes.length).toBe(1);
    expect(result.quotes[0].reference).toBe('2:177'); // NOT '2:1'
  });

  it('should validate text against the cited verse, not search the entire Quran', () => {
    // Exact text from 51:19 tagged with ref="51:19"
    const text = `<quran ref="51:19">وَفِىٓ أَمْوَٰلِهِمْ حَقٌّ لِّلسَّآئِلِ وَٱلْمَحْرُومِ</quran>`;

    const result = processor.process(text);

    expect(result.quotes.length).toBe(1);
    expect(result.quotes[0].reference).toBe('51:19');
    expect(result.quotes[0].isValid).toBe(true);
  });

  it('should correct text with wrong reference to actual verse', () => {
    // Exact text from 51:19 but tagged as ref="1:1" (wrong verse)
    // Global search finds exact match, so corrects to 51:19
    const text = `<quran ref="1:1">وَفِىٓ أَمْوَٰلِهِمْ حَقٌّ لِّلسَّآئِلِ وَٱلْمَحْرُومِ</quran>`;

    const result = processor.process(text);

    expect(result.quotes.length).toBe(1);
    // Should be corrected to the actual reference where this text exists
    expect(result.quotes[0].isValid).toBe(true);
    expect(result.quotes[0].reference).toBe('51:19');
    expect(result.quotes[0].wasCorrected).toBe(true);
  });

  it('should handle multiple tagged quotes - keeps cited ref, marks invalid if no match', () => {
    // All these are partial/truncated verses that won't match exactly
    const text = `
      <quran ref="2:177">لَيْسَ الْبِرَّ أَنْ تُوَلُّوا وُجُوهَكُمْ</quran>
      <quran ref="51:19">وَفِىٓ أَمْوَٰلِهِمْ حَقٌّ لِّلسَّآئِلِ وَٱلْمَحْرُومِ</quran>
      <quran ref="112:1">قُلْ هُوَ ٱللَّهُ أَحَدٌ</quran>
    `;

    const result = processor.process(text);

    expect(result.quotes.length).toBe(3);

    // Check that valid exact matches work
    const validQuotes = result.quotes.filter(q => q.isValid);
    expect(validQuotes.some(q => q.reference === '51:19')).toBe(true);
    expect(validQuotes.some(q => q.reference === '112:1')).toBe(true);

    // Truncated 2:177 should be invalid
    const q2177 = result.quotes.find(q => q.reference === '2:177');
    expect(q2177?.isValid).toBe(false);
  });

  it('should mark as invalid for non-existent verse reference with low-confidence global match', () => {
    // 999:999 doesn't exist, "بِسْمِ ٱللَّهِ" is too short for high-confidence match
    const text = `<quran ref="999:999">بِسْمِ ٱللَّهِ</quran>`;

    const result = processor.process(text);

    expect(result.quotes.length).toBe(1);
    expect(result.quotes[0].reference).toBe('999:999'); // Keeps cited reference
    expect(result.quotes[0].isValid).toBe(false); // Invalid - verse doesn't exist
  });

  it('should reject truly fabricated text even with valid reference format', () => {
    // 2:100 exists, but this text is completely made up
    const fabricated = `<quran ref="2:100">هذا نص مزيف لا يوجد في القرآن الكريم أبداً</quran>`;

    const result = processor.process(fabricated);

    expect(result.quotes.length).toBe(1);
    expect(result.quotes[0].isValid).toBe(false);
  });
});
