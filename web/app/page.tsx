'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { getLeaderboard, getModels, benchmarkModel, type OpenRouterModel } from './actions';
import type { CachedResult } from '@/lib/cache';

function getRankStyle(rank: number) {
  if (rank === 1) return { medal: '🥇', bg: 'bg-gradient-to-r from-amber-900/30 to-amber-800/10', border: 'border-amber-500/50' };
  if (rank === 2) return { medal: '🥈', bg: 'bg-gradient-to-r from-slate-600/20 to-slate-500/10', border: 'border-slate-400/50' };
  if (rank === 3) return { medal: '🥉', bg: 'bg-gradient-to-r from-orange-900/20 to-orange-800/10', border: 'border-orange-600/50' };
  return { medal: '', bg: 'bg-white/5', border: 'border-white/10' };
}

function AccuracyBadge({ accuracy }: { accuracy: number }) {
  const color = accuracy >= 80 ? 'text-emerald-400' : accuracy >= 50 ? 'text-amber-400' : 'text-red-400';
  return (
    <span className={`font-mono font-bold text-2xl ${color}`}>
      {accuracy}%
    </span>
  );
}

function QuoteDetail({ quote }: { quote: CachedResult['quotes'][0] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`p-4 rounded-lg border cursor-pointer transition-all ${
        quote.isValid
          ? 'bg-emerald-950/30 border-emerald-800/50'
          : 'bg-red-950/30 border-red-800/50'
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-white/60">
          {quote.reference}
        </span>
        <span className={`text-sm font-semibold ${quote.isValid ? 'text-emerald-400' : 'text-red-400'}`}>
          {quote.isValid ? '✓ Valid' : '✗ Invalid'}
        </span>
      </div>
      <p className="font-arabic text-xl leading-relaxed text-white/90 text-right" dir="rtl">
        {quote.original}
      </p>
      {expanded && quote.corrected && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-sm text-white/50 mb-2">Corrected:</p>
          <p className="font-arabic text-xl leading-relaxed text-emerald-400/90 text-right" dir="rtl">
            {quote.corrected}
          </p>
        </div>
      )}
    </div>
  );
}

function ResultCard({ result, rank, isLowest }: { result: CachedResult; rank: number; isLowest: boolean }) {
  const [showDetails, setShowDetails] = useState(false);
  const style = getRankStyle(rank);

  return (
    <div className={`${style.bg} border ${style.border} rounded-xl overflow-hidden transition-all hover:scale-[1.01]`}>
      <div
        className="p-5 cursor-pointer"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 text-center">
            {style.medal ? (
              <span className="text-2xl">{style.medal}</span>
            ) : (
              <span className="text-lg font-bold text-white/40">#{rank}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">{result.icon}</span>
              <h3 className="font-semibold text-white truncate">{result.modelName}</h3>
              {isLowest && (
                <span className="px-2 py-0.5 text-xs font-bold bg-red-900/50 text-red-400 rounded-full">
                  NEEDS WORK
                </span>
              )}
            </div>
            <p className="text-sm text-white/40 truncate">{result.modelId}</p>
          </div>

          <div className="text-right">
            <AccuracyBadge accuracy={result.accuracy} />
            <p className="text-sm text-white/40">
              {result.validCount}/{result.totalCount} correct
            </p>
          </div>

          <svg
            className={`w-5 h-5 text-white/40 transition-transform ${showDetails ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {showDetails && (
        <div className="px-5 pb-5 space-y-3 border-t border-white/10 pt-4">
          {result.quotes.map((quote, i) => (
            <QuoteDetail key={i} quote={quote} />
          ))}
        </div>
      )}
    </div>
  );
}

function ModelSelector({
  models,
  selectedModel,
  onSelect,
  disabled,
}: {
  models: OpenRouterModel[];
  selectedModel: OpenRouterModel | null;
  onSelect: (model: OpenRouterModel) => void;
  disabled: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
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

  const freeModels = filteredModels.filter((m) => m.isFree);
  const paidModels = filteredModels.filter((m) => !m.isFree);

  return (
    <div className="relative flex-1" ref={dropdownRef}>
      <div
        className={`flex items-center gap-2 px-4 py-3 bg-white/5 border rounded-xl cursor-pointer transition-all ${
          isOpen ? 'border-amber-500/50 ring-1 ring-amber-500/25' : 'border-white/10 hover:border-white/20'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !disabled && setIsOpen(true)}
      >
        {selectedModel ? (
          <>
            <span className="text-white">{selectedModel.name}</span>
            {selectedModel.isFree && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded">
                FREE
              </span>
            )}
            {selectedModel.alreadyTested && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 rounded">
                TESTED
              </span>
            )}
          </>
        ) : (
          <span className="text-white/40">Select a model to test...</span>
        )}
        <svg
          className={`w-4 h-4 text-white/40 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="p-2 border-b border-white/10">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models..."
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
              autoFocus
            />
          </div>

          <div className="max-h-80 overflow-y-auto">
            {freeModels.length > 0 && (
              <div>
                <div className="px-3 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 sticky top-0">
                  FREE MODELS ({freeModels.length})
                </div>
                {freeModels.map((model) => (
                  <ModelOption
                    key={model.id}
                    model={model}
                    onSelect={() => {
                      onSelect(model);
                      setIsOpen(false);
                      setSearch('');
                    }}
                  />
                ))}
              </div>
            )}

            {paidModels.length > 0 && (
              <div>
                <div className="px-3 py-2 text-xs font-semibold text-white/50 bg-white/5 sticky top-0">
                  PAID MODELS ({paidModels.length})
                </div>
                {paidModels.map((model) => (
                  <ModelOption
                    key={model.id}
                    model={model}
                    onSelect={() => {
                      onSelect(model);
                      setIsOpen(false);
                      setSearch('');
                    }}
                  />
                ))}
              </div>
            )}

            {filteredModels.length === 0 && (
              <div className="px-4 py-8 text-center text-white/40 text-sm">
                No models found matching &quot;{search}&quot;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ModelOption({ model, onSelect }: { model: OpenRouterModel; onSelect: () => void }) {
  return (
    <div
      className="px-3 py-2.5 hover:bg-white/5 cursor-pointer flex items-center gap-2 transition-colors"
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm truncate">{model.name}</span>
          {model.alreadyTested && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 rounded flex-shrink-0">
              TESTED
            </span>
          )}
        </div>
        <p className="text-xs text-white/40 truncate">{model.id}</p>
      </div>
      {!model.isFree && (
        <span className="text-xs text-white/30 flex-shrink-0">
          ${(parseFloat(model.pricing.prompt) * 1000000).toFixed(2)}/M
        </span>
      )}
    </div>
  );
}

export default function Home() {
  const [leaderboard, setLeaderboard] = useState<CachedResult[]>([]);
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<OpenRouterModel | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getLeaderboard(), getModels()]).then(([results, modelList]) => {
      setLeaderboard(results);
      setModels(modelList);
      setLoading(false);
    });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModel) return;

    setError(null);
    startTransition(async () => {
      const response = await benchmarkModel(selectedModel.id, selectedModel.name);
      if (response.success) {
        setLeaderboard((prev) => {
          const filtered = prev.filter((r) => r.modelId !== response.result.modelId);
          return [...filtered, response.result].sort((a, b) => b.accuracy - a.accuracy);
        });
        // Mark model as tested
        setModels((prev) =>
          prev.map((m) =>
            m.id === selectedModel.id ? { ...m, alreadyTested: true } : m
          )
        );
        setSelectedModel(null);
      } else {
        setError(response.error);
      }
    });
  };

  const lowestAccuracy = leaderboard.length > 0
    ? Math.min(...leaderboard.map((r) => r.accuracy))
    : 0;

  return (
    <main className="min-h-screen">
      {/* Geometric background pattern */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30L30 0z' fill='none' stroke='white' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="text-center mb-12">
          <div className="inline-block mb-6">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center">
              <span className="text-4xl">📖</span>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-amber-100 to-white bg-clip-text text-transparent">
            Can LLMs Quote the Quran?
          </h1>
          <p className="text-lg text-white/60 max-w-xl mx-auto">
            Testing how accurately AI models quote Quranic verses.
            Select any model from OpenRouter to benchmark.
          </p>
        </header>

        {/* Model Selector Form */}
        <form onSubmit={handleSubmit} className="mb-10">
          <div className="flex gap-3">
            <ModelSelector
              models={models}
              selectedModel={selectedModel}
              onSelect={setSelectedModel}
              disabled={isPending || loading}
            />
            <button
              type="submit"
              disabled={isPending || !selectedModel}
              className="px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:from-white/10 disabled:to-white/10 disabled:text-white/30 rounded-xl font-semibold transition-all disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Model'
              )}
            </button>
          </div>
          {error && (
            <p className="mt-3 text-red-400 text-sm">{error}</p>
          )}
        </form>

        {/* Leaderboard */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white/80">Leaderboard</h2>
            <span className="text-sm text-white/40">
              {leaderboard.length} model{leaderboard.length !== 1 ? 's' : ''} tested
            </span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-white/40">
              Loading...
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl">
              <p className="text-white/40 mb-2">No models tested yet</p>
              <p className="text-sm text-white/30">
                Select a model above to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((result, index) => (
                <ResultCard
                  key={result.modelId}
                  result={result}
                  rank={index + 1}
                  isLowest={result.accuracy === lowestAccuracy && leaderboard.length > 1}
                />
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-white/10 text-center">
          <p className="text-sm text-white/30">
            Powered by{' '}
            <a
              href="https://www.npmjs.com/package/quran-validator"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-500/70 hover:text-amber-500 transition-colors"
            >
              quran-validator
            </a>
            {' '}•{' '}
            <a
              href="https://openrouter.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-500/70 hover:text-amber-500 transition-colors"
            >
              OpenRouter
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
