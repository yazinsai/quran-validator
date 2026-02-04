'use server';

import { runBenchmark } from '@/lib/benchmark';
import { getAllCachedResults, getCachedResult, type CachedResult } from '@/lib/cache';

export interface OpenRouterModel {
  id: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  isFree: boolean;
  provider: string;
  alreadyTested: boolean;
}

// Priority providers (shown first within each price tier)
const PRIORITY_PROVIDERS = [
  'anthropic',
  'openai',
  'google',
  'meta-llama',
  'mistralai',
  'deepseek',
  'qwen',
  'cohere',
];

export async function getModels(): Promise<OpenRouterModel[]> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error('Failed to fetch models');
    }

    const data = await response.json();
    const models: OpenRouterModel[] = data.data.map((m: {
      id: string;
      name: string;
      pricing: { prompt: string; completion: string };
    }) => {
      const provider = m.id.split('/')[0];
      const promptPrice = parseFloat(m.pricing.prompt) || 0;
      const isFree = promptPrice === 0;

      return {
        id: m.id,
        name: m.name,
        pricing: m.pricing,
        isFree,
        provider,
        alreadyTested: getCachedResult(m.id) !== null,
      };
    });

    // Sort: free first, then by price, with priority providers first within each tier
    models.sort((a, b) => {
      // Free models first
      if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;

      // Within same tier, priority providers first
      const aPriority = PRIORITY_PROVIDERS.indexOf(a.provider);
      const bPriority = PRIORITY_PROVIDERS.indexOf(b.provider);
      const aHasPriority = aPriority !== -1;
      const bHasPriority = bPriority !== -1;

      if (aHasPriority !== bHasPriority) return aHasPriority ? -1 : 1;
      if (aHasPriority && bHasPriority && aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // Then by price
      const aPrice = parseFloat(a.pricing.prompt) || 0;
      const bPrice = parseFloat(b.pricing.prompt) || 0;
      return aPrice - bPrice;
    });

    return models;
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
}

export async function getLeaderboard(): Promise<CachedResult[]> {
  return getAllCachedResults();
}

export async function benchmarkModel(
  modelId: string,
  modelName: string
): Promise<{ success: true; result: CachedResult } | { success: false; error: string }> {
  try {
    // Get provider icon
    const provider = modelId.split('/')[0];
    const icon = getProviderIcon(provider);

    const result = await runBenchmark(modelId, modelName, icon);
    return { success: true, result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function getProviderIcon(provider: string): string {
  const icons: Record<string, string> = {
    anthropic: '🟤',
    openai: '🟢',
    google: '🔵',
    'meta-llama': '🦙',
    mistralai: '🌀',
    deepseek: '🔮',
    qwen: '🟣',
    cohere: '🟠',
    perplexity: '🔍',
    'x-ai': '✖️',
  };
  return icons[provider] || '🤖';
}
