import { NextRequest, NextResponse } from 'next/server';
import { completion } from '@rocketnew/llm-sdk';
import { OLLAMA_PROVIDER, describeOllamaFailure, ollamaChatCompletion } from '@/lib/ai/ollama';

const API_KEYS: Record<string, string | undefined> = {
  OPEN_AI: process.env.OPENAI_API_KEY,
  ANTHROPIC: process.env.ANTHROPIC_API_KEY,
  GEMINI: process.env.GEMINI_API_KEY,
  PERPLEXITY: process.env.PERPLEXITY_API_KEY,
};

function formatErrorResponse(error: unknown, provider?: string) {
  const statusCode = (error as any)?.statusCode || (error as any)?.status || 500;
  const providerName = (error as any)?.llmProvider || provider || 'Unknown';

  return {
    error: `${providerName.toUpperCase()} API error: ${statusCode}`,
    details: error instanceof Error ? error.message : String(error),
    statusCode,
  };
}

const encoder = new TextEncoder();

function sse(payload: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * Streams Ollama's OpenAI-compatible SSE output using the same envelope the
 * hosted providers use: {type:'start'} → {type:'chunk', chunk} → {type:'done'}.
 */
function streamOllama(upstream: Response): NextResponse {
  const readable = new ReadableStream({
    async start(controller) {
      const reader = upstream.body?.getReader();

      if (!reader) {
        controller.enqueue(
          sse({
            type: 'error',
            error: 'OLLAMA API error: 500',
            details: 'Response body is not readable',
          })
        );
        controller.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        controller.enqueue(sse({ type: 'start' }));

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;

            const payload = trimmed.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;

            try {
              controller.enqueue(sse({ type: 'chunk', chunk: JSON.parse(payload) }));
            } catch {
              // Ignore partial/invalid JSON frames.
            }
          }
        }

        controller.enqueue(sse({ type: 'done' }));
        controller.close();
      } catch (error) {
        const details = describeOllamaFailure(error);
        console.error('API Route Error:', { error: 'OLLAMA stream error', details });
        controller.enqueue(sse({ type: 'error', error: 'OLLAMA API error: 500', details }));
        controller.close();
      }
    },
  });

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

export async function POST(request: NextRequest) {
  let body: any = {};

  try {
    body = await request.json();
    const { provider, model, messages, stream = false, parameters = {} } = body;

    if (!provider || !model || !messages?.length) {
      return NextResponse.json(
        {
          error: 'Missing required fields: provider, model, messages',
          details: 'Request validation failed',
        },
        { status: 400 }
      );
    }

    // Local models: no API key, talk straight to the Ollama daemon.
    if (provider === OLLAMA_PROVIDER) {
      try {
        if (stream) {
          const upstream = await ollamaChatCompletion({
            model,
            messages,
            stream: true,
            parameters,
          });
          return streamOllama(upstream as Response);
        }

        const response = await ollamaChatCompletion({ model, messages, stream: false, parameters });
        return NextResponse.json(response);
      } catch (error) {
        const statusCode = (error as any)?.statusCode || 503;
        const details = describeOllamaFailure(error);
        console.error('API Route Error:', { error: `OLLAMA API error: ${statusCode}`, details });
        return NextResponse.json(
          { error: `OLLAMA API error: ${statusCode}`, details },
          { status: statusCode }
        );
      }
    }

    const apiKey = API_KEYS[provider];
    if (!apiKey) {
      return NextResponse.json(
        {
          error: `${provider.toUpperCase()} API key is not configured`,
          details: 'The API key for this provider is missing in environment variables',
        },
        { status: 400 }
      );
    }

    if (stream) {
      const response = await completion({
        model,
        messages,
        stream: true,
        api_key: apiKey,
        ...parameters,
      });

      const readable = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(sse({ type: 'start' }));

            for await (const chunk of response as unknown as AsyncIterable<unknown>) {
              controller.enqueue(sse({ type: 'chunk', chunk }));
            }

            controller.enqueue(sse({ type: 'done' }));
            controller.close();
          } catch (error) {
            const formatted = formatErrorResponse(error, provider);
            console.error('API Route Error:', {
              error: formatted.error,
              details: formatted.details,
            });
            controller.enqueue(
              sse({ type: 'error', error: formatted.error, details: formatted.details })
            );
            controller.close();
          }
        },
      });

      return new NextResponse(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    const response = await completion({
      model,
      messages,
      stream: false,
      api_key: apiKey,
      ...parameters,
    });

    return NextResponse.json(response);
  } catch (error) {
    const formatted = formatErrorResponse(error, body?.provider);
    console.error('API Route Error:', { error: formatted.error, details: formatted.details });
    return NextResponse.json(
      { error: formatted.error, details: formatted.details },
      { status: formatted.statusCode }
    );
  }
}
