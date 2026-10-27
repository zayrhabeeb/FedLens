/**
 * Optional bring-your-own-endpoint synthesis via any OpenAI-compatible
 * /chat/completions API — including free, local servers such as Ollama or
 * LM Studio. Off by default. The key (if any) lives only in this browser's
 * chrome.storage.local; FedLens ships no keys and has no server.
 */
import type { ByokSettings } from '../data/settings';
import { rewritePrompt } from './shield';
import type { SynthesisRequest } from './types';

/** Origin pattern to request as an optional host permission before calling the endpoint. */
export function endpointOrigin(endpoint: string): string {
  const url = new URL(endpoint);
  return `${url.protocol}//${url.hostname}/*`;
}

export async function rewriteWithByok(
  request: SynthesisRequest,
  cfg: ByokSettings,
  timeoutMs = 60_000,
): Promise<string> {
  const res = await fetch(`${cfg.endpoint.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.2,
      max_tokens: 350,
      messages: [
        {
          role: 'system',
          content: 'You rewrite structured economic analysis for clarity. You never add facts.',
        },
        { role: 'user', content: rewritePrompt(request) },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Endpoint returned HTTP ${res.status}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content?.trim() ?? '';
}
