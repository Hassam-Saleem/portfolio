import { answerQuestion } from "@/lib/rag/answer";
import type { ChatMessage } from "@/lib/rag/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_QUESTION = 500;
const MAX_HISTORY = 8;

// Best-effort abuse guard for the free-tier LLM quota. In-memory, so it is per serverless instance.
const WINDOW_MS = 10 * 60_000;
const MAX_REQUESTS = 30;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5_000) for (const [k, v] of hits) if (now - v[v.length - 1] > WINDOW_MS) hits.delete(k);
  return recent.length > MAX_REQUESTS;
}

const json = (status: number, message: string) =>
  Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, "Invalid JSON body.");
  }

  const raw = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(raw) || raw.length === 0) return json(400, "`messages` must be a non-empty array.");

  const messages: ChatMessage[] = [];
  for (const m of raw.slice(-MAX_HISTORY - 1)) {
    const { role, content } = (m ?? {}) as Partial<ChatMessage>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      return json(400, "Each message needs a role (user|assistant) and string content.");
    }
    messages.push({ role, content: content.slice(0, 1000) });
  }
  const last = messages[messages.length - 1];
  if (last.role !== "user" || !last.content.trim()) return json(400, "The last message must be a non-empty user message.");
  if (last.content.length > MAX_QUESTION) return json(400, `Please keep questions under ${MAX_QUESTION} characters.`);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return json(429, "Too many questions in a short time. Please wait a few minutes and try again.");

  const abort = new AbortController();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of answerQuestion(last.content.trim(), messages.slice(0, -1), abort.signal)) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      } catch (e) {
        console.error("[api/chat]", e);
        controller.enqueue(
          encoder.encode(`${JSON.stringify({ type: "error", message: "Something went wrong. Please try again." })}\n`),
        );
      } finally {
        controller.close();
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
