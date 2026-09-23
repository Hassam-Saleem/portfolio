import type { ChatTarget } from "./config";

const DEFAULT_FIRST_TOKEN_MS = 12_000;
const IDLE_MS = 15_000;

type Msg = { role: "system" | "user" | "assistant"; content: string };

export class LlmError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

/**
 * Stream a chat completion (OpenAI-compatible SSE). Yields answer text only — a reasoning model's
 * `reasoning_content` deltas are ignored. Throws before the first token if the request fails or stalls, so the
 * caller can move on to the next model.
 *
 * Free-tier endpoints sometimes accept a request and then never answer, so the wait for the first *answer* token is
 * capped (`firstTokenMs`), even if a reasoning model keeps streaming thoughts; after that a 15 s idle limit applies.
 */
export async function* streamChat(
  target: ChatTarget,
  messages: Msg[],
  signal?: AbortSignal,
  firstTokenMs: number = DEFAULT_FIRST_TOKEN_MS,
): AsyncGenerator<string> {
  const { model, baseUrl, apiKey } = target;
  const guard = new AbortController();
  let timer = setTimeout(() => guard.abort(), firstTokenMs);
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "text/event-stream", ...target.headers },
    body: JSON.stringify({ model, messages, stream: true, temperature: 0, top_p: 1, max_tokens: 350, ...target.extra }),
    signal: signal ? AbortSignal.any([signal, guard.signal]) : guard.signal,
  }).catch((e) => {
    clearTimeout(timer);
    throw e;
  });

  if (!res.ok || !res.body) {
    clearTimeout(timer);
    const detail = res.body ? (await res.text()).slice(0, 200) : "";
    throw new LlmError(`${target.label} → HTTP ${res.status} ${detail}`, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) throw new LlmError(`${target.label} → ${String(parsed.error.message ?? parsed.error).slice(0, 160)}`, parsed.error.code);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            clearTimeout(timer);
            timer = setTimeout(() => guard.abort(), IDLE_MS);
            yield delta as string;
          }
        } catch (e) {
          if (e instanceof LlmError) throw e; // a real error event from the API; anything else is a keep-alive / partial JSON line
        }
      }
    }
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
