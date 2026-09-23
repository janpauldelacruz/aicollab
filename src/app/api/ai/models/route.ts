import { NextRequest, NextResponse } from 'next/server';
import { guardAIRequest } from '@/lib/ai/guard';
import { describeOllamaFailure, listOllamaModels, getOllamaBaseUrl } from '@/lib/ai/ollama';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/models
 * Lists the models available for agents to use. Backed by the local Ollama
 * daemon, so the roster reflects whatever the user has actually pulled.
 */
export async function GET(request: NextRequest) {
  const rejected = guardAIRequest(request);
  if (rejected) return rejected.response;

  try {
    const models = await listOllamaModels();
    return NextResponse.json({
      provider: 'OLLAMA',
      baseUrl: getOllamaBaseUrl(),
      models,
    });
  } catch (error) {
    const details = describeOllamaFailure(error);
    console.error('Model list error:', details);
    return NextResponse.json(
      {
        provider: 'OLLAMA',
        baseUrl: getOllamaBaseUrl(),
        models: [],
        error: 'Ollama is not reachable',
        details,
      },
      { status: 503 }
    );
  }
}
