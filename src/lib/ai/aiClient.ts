/** Local models on a busy GPU can take a while — abort well after that, not before. */
export const AI_REQUEST_TIMEOUT_MS = 300_000;

/**
 * Turns the browser's opaque network failures into something a user can act on.
 * A bare "Failed to fetch" almost always means the dev server is not running.
 */
export function describeFetchFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof DOMException && error.name === 'AbortError') {
    return `The model took longer than ${Math.round(AI_REQUEST_TIMEOUT_MS / 1000)}s and the request was cancelled. Try a smaller model, or lower the agent's verbosity.`;
  }

  if (/Failed to fetch|NetworkError|Load failed|ERR_CONNECTION/i.test(message)) {
    return 'Cannot reach the AICollab server. Make sure "npm run dev" is still running on port 4028, then retry.';
  }

  return message;
}

export async function callAIEndpoint(endpoint: string, payload: object) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    let data: any;
    try {
      data = await response.json();
    } catch {
      // A non-JSON body means the route crashed or the dev server restarted.
      throw new Error(
        `The server returned an unreadable response (HTTP ${response.status}). It may have restarted — reload the page and retry.`
      );
    }

    if (!response.ok || data.error) {
      console.error('API Route Error:', {
        error: data.error,
        details: data.details,
      });
      throw new Error(data.details || data.error || `Request failed: ${response.status}`);
    }

    return data;
  } catch (error) {
    const described = describeFetchFailure(error);
    console.error('API request error:', described);
    throw new Error(described);
  } finally {
    clearTimeout(timeout);
  }
}
