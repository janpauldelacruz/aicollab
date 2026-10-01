'use client';

import { useCallback, useEffect, useState } from 'react';
import { describeFetchFailure } from './aiClient';

export interface ModelOption {
  id: string;
  label: string;
  family: string;
  parameterSize: string;
  quantization: string;
  sizeGB: number;
  vision: boolean;
}

/**
 * Fallback roster used before /api/ai/models responds (and if Ollama is down),
 * so every model <select> renders something usable. Anything actually pulled on
 * the host replaces this at runtime.
 */
export const FALLBACK_MODELS: ModelOption[] = [
  {
    id: 'qwen2.5:7b',
    label: 'Qwen2.5 7B',
    family: 'qwen2',
    parameterSize: '7.6B',
    quantization: '',
    sizeGB: 4.36,
    vision: false,
  },
  {
    id: 'qwen2.5:14b',
    label: 'Qwen2.5 14B',
    family: 'qwen2',
    parameterSize: '14.8B',
    quantization: '',
    sizeGB: 8.37,
    vision: false,
  },
  {
    id: 'hermes3:latest',
    label: 'Hermes3',
    family: 'llama',
    parameterSize: '8.0B',
    quantization: '',
    sizeGB: 4.34,
    vision: false,
  },
  {
    id: 'gemma4:latest',
    label: 'Gemma4',
    family: 'gemma4',
    parameterSize: '8.0B',
    quantization: '',
    sizeGB: 8.95,
    vision: false,
  },
  {
    id: 'gemma3:4b',
    label: 'Gemma3 4B',
    family: 'gemma3',
    parameterSize: '4.3B',
    quantization: '',
    sizeGB: 3.11,
    vision: false,
  },
];

/** Short label for compact UI (cards, chips). */
export function shortModelLabel(modelId: string): string {
  const [name, version] = modelId.split(':');
  const pretty = name.charAt(0).toUpperCase() + name.slice(1);
  if (!version || version === 'latest') return pretty;
  return `${pretty} ${version}`;
}

/** Badge text shown next to a model in selects. */
export function modelBadge(model: ModelOption): string {
  const bits = [model.parameterSize, model.vision ? 'vision' : ''].filter(Boolean);
  return bits.length ? `Ollama · ${bits.join(' · ')}` : 'Ollama';
}

/** A free hosted provider as listed by /api/ai/models (see openaiCompat.ts). */
export interface CloudProvider {
  providerId: string;
  label: string;
  /** False when the provider needs a key the caller has not added yet. */
  available: boolean;
  keyRequired: boolean;
  freeTier: string;
  signupUrl: string;
  live: boolean;
  models: { id: string; label: string }[];
}

/** First usable free hosted model — what a roster falls back to without Ollama. */
export function firstCloudModel(cloud: CloudProvider[]): string | null {
  for (const p of cloud) {
    if (p.available && p.models.length > 0) return p.models[0].id;
  }
  return null;
}

export interface UseAvailableModelsResult {
  models: ModelOption[];
  /** Free hosted providers — usable ones and ones still waiting for a key. */
  cloud: CloudProvider[];
  loading: boolean;
  /** Set when Ollama could not be reached; models falls back to FALLBACK_MODELS. */
  error: string | null;
  baseUrl: string | null;
  refresh: () => void;
}

/** Fetches the local Ollama models and the free hosted providers for model pickers. */
export function useAvailableModels(): UseAvailableModelsResult {
  const [models, setModels] = useState<ModelOption[]>(FALLBACK_MODELS);
  const [cloud, setCloud] = useState<CloudProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/ai/models', { cache: 'no-store' });
        const data = await response.json();
        if (cancelled) return;

        setBaseUrl(data?.baseUrl ?? null);
        setCloud(Array.isArray(data?.cloud) ? data.cloud : []);

        if (Array.isArray(data?.models) && data.models.length > 0) {
          setModels(data.models);
          setError(null);
        } else {
          setModels(FALLBACK_MODELS);
          setError(data?.details || data?.error || 'No Ollama models found');
        }
      } catch (err) {
        if (cancelled) return;
        setModels(FALLBACK_MODELS);
        setError(describeFetchFailure(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { models, cloud, loading, error, baseUrl, refresh };
}
