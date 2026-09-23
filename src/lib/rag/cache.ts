import type { RagEvent } from "./types";

// Tiny in-memory answer cache. Free-tier LLMs rate-limit hard, and visitors click the same suggested
// questions, so identical single-turn questions are replayed instead of re-hitting the model.
// Per serverless instance only (no external store) — a best-effort optimisation, not a correctness feature.
const TTL_MS = 60 * 60_000;
const MAX_ENTRIES = 200;
const store = new Map<string, { at: number; events: RagEvent[] }>();

export const cacheKey = (question: string) => question.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();

export function cacheGet(key: string): RagEvent[] | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    store.delete(key);
    return null;
  }
  return hit.events;
}

export function cacheSet(key: string, events: RagEvent[]): void {
  if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value as string);
  store.set(key, { at: Date.now(), events });
}
