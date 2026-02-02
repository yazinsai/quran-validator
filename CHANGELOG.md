# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2025-02-02

### Added
- **Verse range support**: Validate multiple consecutive verses with range references like `2:255-257` or `112:1-4`
- New `getVerseRange(surah, startAyah, endAyah)` method on `QuranValidator`
- Updated system prompts with verse range examples
- LLMs can now tag verse ranges: `<quran ref="112:1-4">...</quran>`

### Fixed
- Improved reference parsing to handle edge cases

## [1.0.1] - 2025-02-02

### Fixed
- README now displays correctly on npm

## [1.0.0] - 2025-02-02

### Added
- Initial release
- `QuranValidator` class for validating Quranic verses
- `LLMProcessor` class for processing LLM output with tagged Quran quotes
- Multi-tier matching: exact, normalized, partial, and fuzzy
- Auto-correction of misquoted verses
- Arabic text normalization utilities
- System prompts for LLM integration (XML, Markdown, Bracket, Minimal formats)
- Full Quran database (6,236 verses) from QUL/Tarteel
- `quickValidate()` helper for simple validation
- TypeScript support with full type definitions
- Zero runtime dependencies
