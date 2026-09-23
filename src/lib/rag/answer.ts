import { cacheGet, cacheKey, cacheSet } from "./cache";
import { CONFIG, chatTargets } from "./config";
import { LlmError } from "./llm";
import { buildMessages, NO_INFO_MARKER, REFUSAL_TEXT } from "./prompt";
import { raceForFirstToken } from "./race";
import { looksLikeRefusal } from "./refusal";
import { smallTalkReply } from "./smalltalk";
import { retrieve } from "./retrieve";
import type { ChatMessage, RagEvent, ScoredChunk, Source } from "./types";

const BUDGET_MS = 32_000; // total time to the first answer token (embedding + retrieval + all models); the widget gives up at 40 s
const FIRST_TOKEN_MS = 12_000; // per-model cap on the wait for its first answer token
const HEDGE_MS = 4_000; // start the next model in parallel if nothing has arrived after this long
const MIN_ATTEMPT_MS = 4_000; // don't start a model with less time than this left

// Reserve providers (Gemini / Mistral / OpenRouter free tiers) are only reached after the NVIDIA models fail, and even
// then each server instance may send at most this many requests to them per hour, so a bad afternoon can't drain them.
const RESERVE_MAX_PER_HOUR = Number(process.env.RESERVE_MAX_PER_HOUR || 20);
const reserveHits: number[] = [];
function reserveBudgetLeft(): boolean {
  const cutoff = Date.now() - 3_600_000;
  while (reserveHits.length && reserveHits[0] < cutoff) reserveHits.shift();
  return reserveHits.length < RESERVE_MAX_PER_HOUR;
}

// Per-instance model health. Models that answered recently go first; ones that just failed go last (permanent errors —
// 404/410 model gone, 401/403 bad key — for longer), so a dead free-tier endpoint is a late hedge, not the first wait.
const cooldownUntil = new Map<string, number>();
const lastSuccess = new Map<string, number>();
function markUnhealthy(label: string, error: unknown) {
  const status = error instanceof LlmError ? error.status : undefined;
  const permanent = status !== undefined && status >= 400 && status < 500 && status !== 429;
  cooldownUntil.set(label, Date.now() + (permanent ? 10 * 60_000 : 90_000));
}
function markHealthy(label: string) {
  cooldownUntil.delete(label);
  lastSuccess.set(label, Date.now());
}
function orderByHealth<T extends { label: string }>(targets: T[]): T[] {
  const cooling = (t: T) => (cooldownUntil.get(t.label) ?? 0) > Date.now();
  const rank = (t: T) => (cooling(t) ? 1 : 0);
  return [...targets].sort((x, y) => rank(x) - rank(y) || (lastSuccess.get(y.label) ?? 0) - (lastSuccess.get(x.label) ?? 0));
}

const HOLD_CHARS = 48; // held back to classify the start of an answer before it is shown

const BUSY_MESSAGE = "The AI model is busy right now (free-tier limit). Please try again in a few seconds.";

/** Short follow-ups ("what about his education?") embed poorly alone, so borrow the previous user turn. */
function retrievalQuery(question: string, history: ChatMessage[]): string {
  const words = question.trim().split(/\s+/).length;
  const prevUser = [...history].reverse().find((m) => m.role === "user");
  return words <= 6 && prevUser ? `${prevUser.content}\n${question}` : question;
}

/** The two best-matching retrieved chunks (deduped) — shown to the visitor as "retrieved from". */
function toSources(chunks: ScoredChunk[]): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const c of chunks) {
    if (c.score < CONFIG.minRelevance || /^Suggested Questions/i.test(c.heading)) continue;
    const key = `${c.source}|${c.heading}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ source: c.source, docTitle: c.docTitle, heading: c.heading });
    if (out.length === 2) break;
  }
  return out;
}

/**
 * The whole RAG turn as a stream of events (used by the HTTP route and by the eval script).
 * Identical single-turn questions are served from a small in-memory cache to spare the free-tier LLM quota.
 */
export async function* answerQuestion(
  question: string,
  history: ChatMessage[] = [],
  signal?: AbortSignal,
): AsyncGenerator<RagEvent> {
  const chat = smallTalkReply(question);
  if (chat) {
    yield { type: "token", text: chat };
    yield { type: "done", refused: false, sources: [], model: null, topScore: null, backend: null };
    return;
  }

  const key = history.length === 0 ? cacheKey(question) : null;
  if (key) {
    const hit = cacheGet(key);
    if (hit) {
      yield* hit;
      return;
    }
  }

  let text = "";
  let doneEvent: RagEvent | undefined;
  let failed = false;
  for await (const event of generate(question, history, signal)) {
    if (event.type === "token") text += event.text;
    else if (event.type === "done") doneEvent = event;
    else if (event.type === "error") failed = true;
    yield event;
  }
  if (key && doneEvent && !failed) cacheSet(key, [{ type: "token", text }, doneEvent]);
}

/** retrieve → relevance gate → prompt with retrieved chunks only → stream LLM (retry + provider fallback) → done. */
async function* generate(question: string, history: ChatMessage[], signal?: AbortSignal): AsyncGenerator<RagEvent> {
  const started = Date.now(); // one clock for the whole turn: embedding + retrieval + every model attempt
  yield { type: "status", stage: "retrieving" };

  let chunks: ScoredChunk[];
  let backend: "supabase" | "json";
  try {
    ({ chunks, backend } = await retrieve(retrievalQuery(question, history)));
  } catch (e) {
    console.error("[answer] retrieval failed:", e);
    yield { type: "error", message: "Search is temporarily unavailable. Please try again in a moment." };
    return;
  }

  const topScore = chunks[0]?.score ?? null;
  const done = (extra: Partial<Extract<RagEvent, { type: "done" }>>): RagEvent => ({
    type: "done",
    refused: false,
    sources: [],
    model: null,
    topScore,
    backend,
    ...extra,
  });

  // Gate: nothing in the corpus is even close → refuse deterministically, never ask the LLM to improvise.
  if (topScore === null || topScore < CONFIG.minRelevance) {
    yield { type: "token", text: REFUSAL_TEXT };
    yield done({ refused: true });
    return;
  }

  yield { type: "status", stage: "generating" };
  const messages = buildMessages(question, history.slice(-4), chunks);

  const winner = await raceForFirstToken(orderByHealth(chatTargets()), messages, {
    signal,
    budgetMs: BUDGET_MS - (Date.now() - started),
    hedgeMs: HEDGE_MS,
    firstTokenMs: FIRST_TOKEN_MS,
    minAttemptMs: MIN_ATTEMPT_MS,
    canLaunch: (target) => !target.reserve || reserveBudgetLeft(),
    onLaunch: (target) => {
      if (target.reserve) reserveHits.push(Date.now());
    },
    onFail: (target, error) => {
      console.warn(`[answer] ${target.label} failed:`, error instanceof Error ? error.message : error);
      markUnhealthy(target.label, error);
    },
  });
  if (!winner) {
    yield { type: "error", message: BUSY_MESSAGE };
    return;
  }

  // Consume the winning stream (its first delta was already read by the race).
  const source = (async function* () {
    yield winner.first;
    yield* winner.stream;
  })();
  let head = "";
  let decided = false;
  let refused = false;
  let emitted = false;
  try {
    for await (const delta of source) {
      if (decided) {
        const piece = emitted ? delta : delta.trimStart(); // no leading space/newline at the start of the visible answer
        if (!piece) continue;
        emitted = true;
        yield { type: "token", text: piece };
        continue;
      }
      // Hold back the start of the answer until we know whether it is a refusal.
      head += delta;
      const t = head.trimStart();
      if (t.startsWith(NO_INFO_MARKER)) {
        refused = true;
        break;
      }
      if (NO_INFO_MARKER.startsWith(t)) continue; // might still turn into the marker
      if (t.length >= HOLD_CHARS) {
        if (looksLikeRefusal(t)) {
          refused = true;
          break;
        }
        decided = true;
        emitted = true;
        yield { type: "token", text: t };
      }
    }
    if (!decided && !refused) {
      const t = head.trim();
      if (looksLikeRefusal(t)) refused = true;
      else if (t) {
        emitted = true;
        yield { type: "token", text: t };
      } else throw new Error("empty completion");
    }
    if (refused) yield { type: "token", text: REFUSAL_TEXT }; // canonical one-liner, whatever the model wrote
  } catch (e) {
    console.warn(`[answer] ${winner.target.label} stream failed:`, e instanceof Error ? e.message : e);
    markUnhealthy(winner.target.label, e);
    yield { type: "error", message: emitted ? "The answer was interrupted. Please try again." : BUSY_MESSAGE };
    return;
  }
  markHealthy(winner.target.label);
  yield done({ refused, model: winner.target.label, sources: refused ? [] : toSources(chunks) });
}
