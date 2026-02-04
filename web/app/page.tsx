'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { Icon } from '@iconify/react';
import { getLeaderboard, getModels, benchmarkModel, type OpenRouterModel } from './actions';
import type { CachedResult, InvalidReason, PromptResult } from '@/lib/cache';

function getRankDisplay(rank: number) {
  if (rank === 1) return { accent: 'bg-sage text-white' };
  if (rank === 2) return { accent: 'bg-charcoal-light text-white' };
  if (rank === 3) return { accent: 'bg-terracotta text-white' };
  return { accent: 'bg-sand text-charcoal-light' };
}

function AccuracyDisplay({ accuracy, totalCount }: { accuracy: number; totalCount: number }) {
  if (totalCount === 0) {
    return (
      <span className="font-display text-2xl font-semibold text-charcoal-muted">
        —
      </span>
    );
  }

  const color = accuracy >= 80
    ? 'text-sage'
    : accuracy >= 50
      ? 'text-terracotta'
      : 'text-red-500';

  return (
    <span className={`font-display text-2xl font-semibold ${color}`}>
      {accuracy}%
    </span>
  );
}

function getInvalidReasonText(reason: InvalidReason): { label: string; description: string; color: string } {
  switch (reason) {
    case 'fabricated':
      return {
        label: 'Fabricated',
        description: 'Text does not exist in the Quran',
        color: 'text-red-600 bg-red-50',
      };
    case 'hallucinated_words':
      return {
        label: 'Hallucinated',
        description: 'Some words are fabricated',
        color: 'text-orange-600 bg-orange-50',
      };
    case 'wrong_reference':
      return {
        label: 'Wrong ref',
        description: 'Valid verse, but wrong surah:ayah cited',
        color: 'text-amber-600 bg-amber-50',
      };
    case 'invalid_reference':
      return {
        label: 'Bad ref',
        description: 'Cited reference does not exist',
        color: 'text-red-600 bg-red-50',
      };
    case 'diacritics_error':
      return {
        label: 'Diacritics',
        description: 'Correct words, wrong tashkeel',
        color: 'text-yellow-600 bg-yellow-50',
      };
    case 'truncated':
      return {
        label: 'Truncated',
        description: 'Only part of the verse',
        color: 'text-blue-600 bg-blue-50',
      };
    default:
      return { label: 'Invalid', description: '', color: 'text-red-500 bg-red-50' };
  }
}

function getPromptTypeLabel(type: string): { label: string; icon: string } {
  switch (type) {
    case 'topical':
      return { label: 'Topic', icon: 'solar:chat-square-call-linear' };
    case 'specific':
      return { label: 'Specific', icon: 'solar:target-linear' };
    default:
      return { label: type, icon: 'solar:question-circle-linear' };
  }
}

function QuoteDetail({ quote }: { quote: CachedResult['quotes'][0] }) {
  const invalidInfo = quote.invalidReason ? getInvalidReasonText(quote.invalidReason) : null;
  const promptInfo = quote.promptType ? getPromptTypeLabel(quote.promptType) : null;

  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        quote.isValid
          ? 'bg-sage/5 border-sage/20'
          : 'bg-red-50 border-red-200'
      }`}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          {promptInfo && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-charcoal-muted bg-sand/50 rounded">
              <Icon icon={promptInfo.icon} className="w-3 h-3" />
              {promptInfo.label}
            </span>
          )}
          <span className="text-sm font-medium text-charcoal-light">
            {quote.reference}
            {quote.expectedReference && quote.reference !== quote.expectedReference && (
              <span className="text-red-400 ml-1">(expected {quote.expectedReference})</span>
            )}
          </span>
        </div>
        {quote.isValid ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-sage">
            <Icon icon="solar:check-circle-bold" className="w-4 h-4" />
            Valid
          </span>
        ) : (
          <div className="text-right">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded ${invalidInfo?.color || 'text-red-500'}`}>
              <Icon icon="solar:close-circle-bold" className="w-3.5 h-3.5" />
              {invalidInfo?.label || 'Invalid'}
            </span>
            {invalidInfo?.description && (
              <p className="text-xs text-charcoal-muted mt-0.5">{invalidInfo.description}</p>
            )}
          </div>
        )}
      </div>

      {quote.original ? (
        <p className="font-arabic text-xl text-charcoal text-right" dir="rtl">
          {quote.original}
        </p>
      ) : (
        <p className="text-sm text-red-400 italic">
          (No text captured - possible parsing error)
        </p>
      )}

      {quote.corrected && (
        <div className="mt-4 pt-4 border-t border-red-200/50">
          <p className="text-xs text-charcoal-muted mb-2 uppercase tracking-wide">
            Actual verse
          </p>
          <p className="font-arabic text-xl text-sage text-right" dir="rtl">
            {quote.corrected}
          </p>
        </div>
      )}
    </div>
  );
}

function PromptResultSection({ result }: { result: PromptResult }) {
  const promptInfo = getPromptTypeLabel(result.promptType);
  const [showResponse, setShowResponse] = useState(false);
  const hasNoQuotes = result.quotes.length === 0;
  const showResponseToggle = hasNoQuotes || result.noArabicContent;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Icon icon={promptInfo.icon} className="w-4 h-4 text-charcoal-muted" />
        <span className="font-medium text-charcoal-light">{promptInfo.label} prompt</span>
        {result.noArabicContent ? (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
            No Arabic in response
          </span>
        ) : (
          <span className="text-xs text-charcoal-muted ml-auto">
            {result.validCount}/{result.totalCount} valid
          </span>
        )}
      </div>
      <p className="text-xs text-charcoal-muted italic pl-6">
        &ldquo;{result.promptText}&rdquo;
      </p>
      {result.quotes.map((quote, i) => (
        <QuoteDetail key={i} quote={quote} />
      ))}

      {/* Show raw response toggle - especially useful when no quotes or no Arabic */}
      {result.rawResponse && (
        <div className="pl-6">
          {showResponseToggle && !showResponse ? (
            <button
              onClick={() => setShowResponse(true)}
              className="text-xs text-sage hover:text-sage-dark flex items-center gap-1"
            >
              <Icon icon="solar:eye-linear" className="w-3.5 h-3.5" />
              Show model response
            </button>
          ) : showResponseToggle || showResponse ? (
            <div className="space-y-2">
              <button
                onClick={() => setShowResponse(false)}
                className="text-xs text-charcoal-muted hover:text-charcoal flex items-center gap-1"
              >
                <Icon icon="solar:eye-closed-linear" className="w-3.5 h-3.5" />
                Hide response
              </button>
              <div className="p-3 bg-cream rounded-lg text-sm text-charcoal-light whitespace-pre-wrap max-h-48 overflow-y-auto border border-sand">
                {result.rawResponse}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ErrorBreakdownBadges({ breakdown }: { breakdown: Record<string, number> }) {
  if (Object.keys(breakdown).length === 0) return null;

  const errorLabels: Record<string, { label: string; color: string }> = {
    fabricated: { label: 'Fabricated', color: 'bg-red-100 text-red-700' },
    hallucinated_words: { label: 'Hallucinated', color: 'bg-orange-100 text-orange-700' },
    wrong_reference: { label: 'Wrong ref', color: 'bg-amber-100 text-amber-700' },
    invalid_reference: { label: 'Bad ref', color: 'bg-red-100 text-red-700' },
    diacritics_error: { label: 'Diacritics', color: 'bg-yellow-100 text-yellow-700' },
    truncated: { label: 'Truncated', color: 'bg-blue-100 text-blue-700' },
    no_arabic_content: { label: 'No Arabic', color: 'bg-gray-100 text-gray-700' },
  };

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {Object.entries(breakdown).map(([key, count]) => {
        const info = errorLabels[key] || { label: key, color: 'bg-gray-100 text-gray-600' };
        return (
          <span
            key={key}
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${info.color}`}
          >
            {info.label}
            <span className="opacity-60">×{count}</span>
          </span>
        );
      })}
    </div>
  );
}

function ResultCard({ result, rank, isHighlighted, onHighlightClear }: {
  result: CachedResult;
  rank: number;
  isHighlighted?: boolean;
  onHighlightClear?: () => void;
}) {
  const [showDetails, setShowDetails] = useState(isHighlighted);
  const cardRef = useRef<HTMLDivElement>(null);
  const display = getRankDisplay(rank);
  const noQuotes = result.totalCount === 0;
  const hasPromptResults = result.promptResults && result.promptResults.length > 0;

  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setShowDetails(true);
    }
  }, [isHighlighted]);

  return (
    <div
      ref={cardRef}
      className={`bg-white rounded-2xl shadow-soft overflow-hidden card-hover animate-fade-in transition-all ${
        isHighlighted ? 'ring-2 ring-sage ring-offset-2' : ''
      }`}
      style={{ animationDelay: `${rank * 40}ms` }}
    >
      <div
        className="p-4 sm:p-5 cursor-pointer"
        onClick={() => {
          setShowDetails(!showDetails);
          if (isHighlighted && onHighlightClear) onHighlightClear();
        }}
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <span className={`inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full text-xs sm:text-sm font-semibold flex-shrink-0 ${display.accent}`}>
            {rank}
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base">{result.icon}</span>
              <h3 className="font-medium text-charcoal truncate text-sm sm:text-base">
                {result.modelName}
              </h3>
              {isHighlighted && (
                <span className="px-2 py-0.5 text-xs font-medium bg-sage/10 text-sage rounded">
                  Selected
                </span>
              )}
            </div>
            {result.errorBreakdown && Object.keys(result.errorBreakdown).length > 0 && (
              <ErrorBreakdownBadges breakdown={result.errorBreakdown} />
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {noQuotes ? (
              <span className="text-xs text-charcoal-muted">No quotes</span>
            ) : (
              <span className="text-xs text-charcoal-muted hidden sm:inline">
                {result.validCount}/{result.totalCount}
              </span>
            )}
            <AccuracyDisplay accuracy={result.accuracy} totalCount={result.totalCount} />
            <Icon
              icon="solar:alt-arrow-down-linear"
              className={`w-5 h-5 text-charcoal-muted transition-transform flex-shrink-0 ${showDetails ? 'rotate-180' : ''}`}
            />
          </div>
        </div>
      </div>

      {showDetails && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-2 space-y-4 border-t border-sand">
          {hasPromptResults ? (
            result.promptResults!.map((pr, i) => (
              <PromptResultSection key={i} result={pr} />
            ))
          ) : noQuotes ? (
            <div className="py-4 text-center">
              <p className="text-sm text-charcoal-light">Model didn&apos;t provide any quotable verses</p>
              <p className="text-xs text-charcoal-muted mt-1">
                Either refused to quote or response couldn&apos;t be parsed
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-charcoal-light">
                {result.validCount} of {result.totalCount} quote{result.totalCount !== 1 ? 's' : ''} matched accurately
              </p>
              {result.quotes.map((quote, i) => (
                <QuoteDetail key={i} quote={quote} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MethodologyModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-soft-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-sand px-6 py-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-charcoal">How We Test</h2>
          <button onClick={onClose} className="p-2 hover:bg-sand rounded-lg transition-colors">
            <Icon icon="solar:close-circle-linear" className="w-5 h-5 text-charcoal-muted" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Why 2 prompts */}
          <section>
            <h3 className="font-medium text-charcoal mb-2 flex items-center gap-2">
              <Icon icon="solar:target-bold-duotone" className="w-5 h-5 text-sage" />
              Two Prompts, Maximum Coverage
            </h3>
            <p className="text-sm text-charcoal-light leading-relaxed">
              We use two carefully chosen prompts that together catch the widest range of error types
              while keeping API costs reasonable.
            </p>
          </section>

          {/* Prompt 1 */}
          <section className="bg-cream rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-sage/20 text-sage text-xs font-semibold">1</span>
              <h4 className="font-medium text-charcoal">Topical Prompt</h4>
            </div>
            <p className="text-sm text-charcoal-light italic mb-3">
              &ldquo;What does the Quran say about giving to the needy? Please share one or two relevant verses.&rdquo;
            </p>
            <div className="text-xs text-charcoal-muted space-y-1">
              <p><strong>Tests:</strong> Fabrication, hallucination, whether model provides references</p>
              <p><strong>Why:</strong> Model chooses which verses to quote — if it makes up content, this catches it</p>
            </div>
          </section>

          {/* Prompt 2 */}
          <section className="bg-cream rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-sage/20 text-sage text-xs font-semibold">2</span>
              <h4 className="font-medium text-charcoal">Specific Verse Prompt</h4>
            </div>
            <p className="text-sm text-charcoal-light italic mb-3">
              &ldquo;Please quote Ayat al-Kursi (Quran 2:255) in Arabic.&rdquo;
            </p>
            <div className="text-xs text-charcoal-muted space-y-1">
              <p><strong>Tests:</strong> Reference accuracy, diacritics, whether model knows famous verses</p>
              <p><strong>Why:</strong> We know exactly what text to expect — any deviation is measurable</p>
            </div>
          </section>

          {/* Error types */}
          <section>
            <h3 className="font-medium text-charcoal mb-3 flex items-center gap-2">
              <Icon icon="solar:danger-triangle-bold-duotone" className="w-5 h-5 text-terracotta" />
              Error Types We Detect
            </h3>
            <div className="grid gap-2">
              {[
                { label: 'Fabricated', desc: 'Text doesn\'t exist anywhere in the Quran', color: 'bg-red-100 text-red-700' },
                { label: 'Hallucinated', desc: 'Some words are real, some invented', color: 'bg-orange-100 text-orange-700' },
                { label: 'Wrong reference', desc: 'Valid verse, but wrong surah:ayah cited', color: 'bg-amber-100 text-amber-700' },
                { label: 'Invalid reference', desc: 'Cited a verse that doesn\'t exist (e.g., 115:1)', color: 'bg-red-100 text-red-700' },
                { label: 'Diacritics error', desc: 'Correct words, wrong tashkeel/vowel marks', color: 'bg-yellow-100 text-yellow-700' },
                { label: 'Truncated', desc: 'Only quoted part of the verse', color: 'bg-blue-100 text-blue-700' },
              ].map((err) => (
                <div key={err.label} className="flex items-center gap-3 text-sm">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${err.color}`}>
                    {err.label}
                  </span>
                  <span className="text-charcoal-muted">{err.desc}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Validation */}
          <section>
            <h3 className="font-medium text-charcoal mb-2 flex items-center gap-2">
              <Icon icon="solar:shield-check-bold-duotone" className="w-5 h-5 text-sage" />
              Validation
            </h3>
            <p className="text-sm text-charcoal-light leading-relaxed">
              Each Arabic quote is validated against the complete Quran corpus using{' '}
              <a
                href="https://www.npmjs.com/package/quran-validator"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sage hover:text-sage-dark font-medium"
              >
                quran-validator
              </a>
              . The validator uses fuzzy matching to detect partial quotes and can identify
              which verse the model was attempting to quote even when the text is incorrect.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function LeaderboardSection({
  leaderboard,
  loading,
  highlightedModelId,
  onHighlightClear,
}: {
  leaderboard: CachedResult[];
  loading: boolean;
  highlightedModelId: string | null;
  onHighlightClear: () => void;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const PAGE_SIZE = 100;

  // Show all results up to current page * PAGE_SIZE
  const displayedResults = leaderboard.slice(0, page * PAGE_SIZE);
  const hasMore = leaderboard.length > page * PAGE_SIZE;
  const remainingCount = leaderboard.length - page * PAGE_SIZE;

  // Search result (if searching and not in displayed results)
  const searchResult = search.trim()
    ? leaderboard.find(
        (r, idx) =>
          idx >= page * PAGE_SIZE &&
          (r.modelName.toLowerCase().includes(search.toLowerCase()) ||
            r.modelId.toLowerCase().includes(search.toLowerCase()))
      )
    : null;

  // Get rank of search result
  const searchResultRank = searchResult
    ? leaderboard.findIndex((r) => r.modelId === searchResult.modelId) + 1
    : null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Icon icon="solar:cup-star-bold-duotone" className="w-5 h-5 text-terracotta" />
        <h2 className="font-medium text-charcoal">Leaderboard</h2>

        {/* Search input */}
        {!loading && leaderboard.length > 3 && (
          <div className="relative ml-auto">
            <Icon
              icon="solar:magnifer-linear"
              className="w-4 h-4 text-charcoal-muted absolute left-2.5 top-1/2 -translate-y-1/2"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find model..."
              className="w-32 sm:w-40 pl-8 pr-2 py-1.5 text-xs bg-cream border border-sand rounded-lg text-charcoal placeholder:text-charcoal-muted focus:outline-none focus:border-sage focus:ring-1 focus:ring-sage/20 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-charcoal-muted hover:text-charcoal"
              >
                <Icon icon="solar:close-circle-linear" className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {(!loading && leaderboard.length <= 3) && (
          <span className="text-xs text-charcoal-muted ml-auto">
            {leaderboard.length} tested
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-charcoal-muted">
          <Icon icon="solar:refresh-bold" className="w-5 h-5 animate-spin mx-auto mb-3 text-sage" />
          Loading results...
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-sand shadow-soft">
          <Icon icon="solar:clipboard-list-linear" className="w-8 h-8 text-charcoal-muted mx-auto mb-3" />
          <p className="text-charcoal-light mb-1">No models tested yet</p>
          <p className="text-sm text-charcoal-muted">
            Add one below to get started
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* All displayed results */}
          {displayedResults.map((result, index) => (
            <ResultCard
              key={result.modelId}
              result={result}
              rank={index + 1}
              isHighlighted={highlightedModelId === result.modelId}
              onHighlightClear={onHighlightClear}
            />
          ))}

          {/* Search result divider + card (if result is beyond current page) */}
          {searchResult && searchResultRank && (
            <>
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-sand" />
                <span className="text-xs text-charcoal-muted">
                  Search result
                </span>
                <div className="flex-1 h-px bg-sand" />
              </div>
              <ResultCard
                result={searchResult}
                rank={searchResultRank}
                isHighlighted={highlightedModelId === searchResult.modelId}
                onHighlightClear={onHighlightClear}
              />
            </>
          )}

          {/* No search result message */}
          {search.trim() && !searchResult && hasMore && (
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-sand" />
              <span className="text-xs text-charcoal-muted">
                No match in remaining results
              </span>
              <div className="flex-1 h-px bg-sand" />
            </div>
          )}

          {/* Load more pagination */}
          {!search.trim() && hasMore && (
            <button
              onClick={() => setPage(p => p + 1)}
              className="w-full py-3 text-sm text-sage hover:text-sage-dark font-medium transition-colors"
            >
              Load more ({remainingCount} remaining)
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function AddModelSection({
  models,
  onBenchmark,
  onSelectTested,
  isPending,
  error,
  disabled,
}: {
  models: OpenRouterModel[];
  onBenchmark: (model: OpenRouterModel) => void;
  onSelectTested: (modelId: string) => void;
  isPending: boolean;
  error: string | null;
  disabled: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedModel, setSelectedModel] = useState<OpenRouterModel | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredModels = models.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.id.toLowerCase().includes(search.toLowerCase())
  );

  // Split into tested and untested
  const untestedModels = filteredModels.filter((m) => !m.alreadyTested);
  const testedModels = filteredModels.filter((m) => m.alreadyTested);

  const freeUntested = untestedModels.filter((m) => m.isFree);
  const paidUntested = untestedModels.filter((m) => !m.isFree);

  const handleSubmit = () => {
    if (selectedModel) {
      if (selectedModel.alreadyTested) {
        // Just highlight in leaderboard
        onSelectTested(selectedModel.id);
        setSelectedModel(null);
        setSearch('');
      } else {
        onBenchmark(selectedModel);
        setSelectedModel(null);
        setSearch('');
      }
    }
  };

  const handleSelectModel = (model: OpenRouterModel) => {
    setSelectedModel(model);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="bg-white rounded-2xl shadow-soft p-5 border border-sand">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-sage/10 flex items-center justify-center flex-shrink-0">
          <Icon icon="solar:add-circle-linear" className="w-5 h-5 text-sage" />
        </div>
        <div>
          <h3 className="font-medium text-charcoal">Test a model</h3>
          <p className="text-sm text-charcoal-muted">Select a model to benchmark or find an existing result.</p>
        </div>
      </div>

      <div className="flex gap-2" ref={dropdownRef}>
        <div className="relative flex-1">
          <div
            className={`flex items-center gap-2 px-3 py-2.5 bg-cream-dark border rounded-lg cursor-pointer transition-all text-sm ${
              isOpen ? 'border-sage ring-1 ring-sage/20' : 'border-sand hover:border-charcoal-muted'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => !disabled && setIsOpen(true)}
          >
            {selectedModel ? (
              <>
                <span className="text-charcoal truncate">{selectedModel.name}</span>
                {selectedModel.alreadyTested && (
                  <span className="px-1.5 py-0.5 text-xs font-medium bg-charcoal-muted/10 text-charcoal-muted rounded flex-shrink-0">
                    Tested
                  </span>
                )}
                {selectedModel.isFree && !selectedModel.alreadyTested && (
                  <span className="px-1.5 py-0.5 text-xs font-medium bg-sage/10 text-sage rounded flex-shrink-0">
                    Free
                  </span>
                )}
              </>
            ) : (
              <span className="text-charcoal-muted">Select model...</span>
            )}
            <Icon
              icon="solar:alt-arrow-down-linear"
              className={`w-4 h-4 text-charcoal-muted ml-auto transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
            />
          </div>

          {isOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-sand rounded-xl shadow-soft-xl z-50 overflow-hidden">
              <div className="p-2 border-b border-sand">
                <div className="relative">
                  <Icon icon="solar:magnifer-linear" className="w-4 h-4 text-charcoal-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search models..."
                    className="w-full pl-9 pr-3 py-2 bg-cream-dark border border-sand rounded-lg text-charcoal text-sm placeholder:text-charcoal-muted focus:outline-none focus:border-sage focus:ring-1 focus:ring-sage/20"
                    autoFocus
                  />
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto">
                {/* Already tested section */}
                {testedModels.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-semibold text-charcoal-muted uppercase tracking-wide bg-white/80 backdrop-blur-sm sticky top-0 flex items-center gap-2 border-b border-sand/50">
                      <Icon icon="solar:check-circle-linear" className="w-3.5 h-3.5" />
                      Already Tested ({testedModels.length})
                    </div>
                    {testedModels.map((model) => (
                      <div
                        key={model.id}
                        className="px-3 py-2 hover:bg-cream cursor-pointer transition-colors flex items-center justify-between"
                        onClick={() => handleSelectModel(model)}
                      >
                        <span className="text-charcoal text-sm truncate">{model.name}</span>
                        <span className="text-xs text-sage font-medium flex-shrink-0 ml-2">
                          View result
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Free untested */}
                {freeUntested.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-semibold text-sage uppercase tracking-wide bg-white/80 backdrop-blur-sm sticky top-0 border-b border-sage/20">
                      Free ({freeUntested.length})
                    </div>
                    {freeUntested.map((model) => (
                      <div
                        key={model.id}
                        className="px-3 py-2 hover:bg-cream cursor-pointer transition-colors"
                        onClick={() => handleSelectModel(model)}
                      >
                        <span className="text-charcoal text-sm">{model.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Paid untested */}
                {paidUntested.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-semibold text-charcoal-muted uppercase tracking-wide bg-white/80 backdrop-blur-sm sticky top-0 border-b border-sand/50">
                      Paid ({paidUntested.length})
                    </div>
                    {paidUntested.map((model) => (
                      <div
                        key={model.id}
                        className="px-3 py-2 hover:bg-cream cursor-pointer flex items-center justify-between transition-colors"
                        onClick={() => handleSelectModel(model)}
                      >
                        <span className="text-charcoal text-sm truncate">{model.name}</span>
                        <span className="text-xs text-charcoal-muted flex-shrink-0 ml-2">
                          ${(parseFloat(model.pricing.prompt) * 1000000).toFixed(2)}/M
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {filteredModels.length === 0 && (
                  <div className="px-3 py-6 text-center text-charcoal-muted text-sm">
                    No models matching &ldquo;{search}&rdquo;
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !selectedModel}
          className="px-4 py-2.5 bg-sage hover:bg-sage-dark disabled:bg-sand disabled:text-charcoal-muted text-white rounded-lg font-medium text-sm transition-all disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isPending ? (
            <>
              <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />
              Testing
            </>
          ) : selectedModel?.alreadyTested ? (
            'Show'
          ) : (
            'Test'
          )}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-red-500 text-sm">{error}</p>
      )}
    </div>
  );
}

export default function Home() {
  const [leaderboard, setLeaderboard] = useState<CachedResult[]>([]);
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMethodology, setShowMethodology] = useState(false);
  const [highlightedModelId, setHighlightedModelId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getLeaderboard(), getModels()]).then(([results, modelList]) => {
      setLeaderboard(results);
      setModels(modelList);
      setLoading(false);
    });
  }, []);

  const handleBenchmark = (model: OpenRouterModel) => {
    setError(null);
    setHighlightedModelId(null);
    startTransition(async () => {
      const response = await benchmarkModel(model.id, model.name);
      if (response.success) {
        setLeaderboard((prev) => {
          const filtered = prev.filter((r) => r.modelId !== response.result.modelId);
          return [...filtered, response.result].sort((a, b) => b.accuracy - a.accuracy);
        });
        setModels((prev) =>
          prev.map((m) =>
            m.id === model.id ? { ...m, alreadyTested: true } : m
          )
        );
        setHighlightedModelId(response.result.modelId);
      } else {
        setError(response.error);
      }
    });
  };

  const handleSelectTested = (modelId: string) => {
    setHighlightedModelId(modelId);
  };

  return (
    <main className="min-h-screen pb-16">
      {/* Decorative elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30L30 0z' fill='none' stroke='%232d3436' stroke-width='0.5'/%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px',
          }}
        />
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-sage/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-terracotta/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-2xl mx-auto px-4 pt-12 sm:pt-16">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 mb-5 rounded-2xl bg-gradient-to-br from-sage/20 to-sage/5 border border-sage/20 shadow-soft">
            <Icon icon="solar:book-bookmark-bold-duotone" className="w-7 h-7 text-sage" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-charcoal mb-3">
            Can LLMs Quote the Quran?
          </h1>
          <p className="text-charcoal-light mb-3">
            Benchmarking AI accuracy on Quranic verses
          </p>
        </header>

        {/* The Prompts Summary */}
        <div className="mb-8 p-4 bg-white rounded-xl border border-sand shadow-soft">
          <div className="flex items-start gap-3">
            <Icon icon="solar:chat-square-call-linear" className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wide text-charcoal-muted">The test</p>
                <button
                  onClick={() => setShowMethodology(true)}
                  className="text-xs text-charcoal-muted hover:text-charcoal transition-colors flex items-center gap-1"
                >
                  <Icon icon="solar:info-circle-linear" className="w-3.5 h-3.5" />
                  How we test
                </button>
              </div>
              <div className="space-y-2 text-sm text-charcoal">
                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sage/10 text-sage text-xs font-semibold flex-shrink-0">1</span>
                  <p className="italic">&ldquo;What does the Quran say about giving to the needy?&rdquo;</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sage/10 text-sage text-xs font-semibold flex-shrink-0">2</span>
                  <p className="italic">&ldquo;Please quote Ayat al-Kursi (2:255) in Arabic.&rdquo;</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <LeaderboardSection
          leaderboard={leaderboard}
          loading={loading}
          highlightedModelId={highlightedModelId}
          onHighlightClear={() => setHighlightedModelId(null)}
        />

        {/* Add Model Section */}
        {!loading && (
          <AddModelSection
            models={models}
            onBenchmark={handleBenchmark}
            onSelectTested={handleSelectTested}
            isPending={isPending}
            error={error}
            disabled={isPending || loading}
          />
        )}

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t border-sand">
          <div className="flex flex-col items-center gap-2">
            <a
              href="https://www.npmjs.com/package/quran-validator"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-sage/10 hover:bg-sage/20 rounded-lg transition-colors"
            >
              <Icon icon="solar:shield-check-bold" className="w-4 h-4 text-sage" />
              <span className="text-sm font-medium text-sage">quran-validator</span>
            </a>
            <p className="text-xs text-charcoal-muted">
              Validate Quranic quotes in LLM output
            </p>
          </div>
        </footer>
      </div>

      {/* Methodology Modal */}
      <MethodologyModal isOpen={showMethodology} onClose={() => setShowMethodology(false)} />
    </main>
  );
}
