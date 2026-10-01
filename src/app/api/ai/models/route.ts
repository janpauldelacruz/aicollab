import { NextRequest, NextResponse } from 'next/server';
import { guardAIRequest } from '@/lib/ai/guard';
import { describeOllamaFailure, listOllamaModels, getOllamaBaseUrl } from '@/lib/ai/ollama';
import { listFreeProviderModels } from '@/lib/ai/openaiCompat';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/models
 * Lists the models available for agents to use. Backed by the local Ollama
 * daemon, so the roster reflects whatever the user has actually pulled. Free
 * hosted providers are listed under `cloud`, with `available` false when the
 * caller has no key for one yet. A down Ollama never hides the cloud list —
 * on a hosted deployment there is no Ollama at all.
 */
export async function GET(request: NextRequest) {
  const rejected = guardAIRequest(request);
  if (rejected) return rejected.response;

  const cloud = await listFreeProviderModels().catch(() => []);

  try {
    const models = await listOllamaModels();
    return NextResponse.json({
      provider: 'OLLAMA',
      baseUrl: getOllamaBaseUrl(),
      models,
      cloud,
    });
  } catch (error) {
    const details = describeOllamaFailure(error);
    console.error('Model list error:', details);
    return NextResponse.json(
      {
        provider: 'OLLAMA',
        baseUrl: getOllamaBaseUrl(),
        models: [],
        cloud,
        error: 'Ollama is not reachable',
        details,
      },
      { status: 503 }
    );
  }
}
