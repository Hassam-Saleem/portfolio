import { CONFIG, requireNvidiaKey } from "./config";

export type EmbedInputType = "query" | "passage";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function l2Normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum) || 1;
  return v.map((x) => x / norm);
}

/**
 * Embed texts with the NVIDIA NIM embeddings endpoint (OpenAI-compatible).
 * Retrieval models need to know whether text is a query or a passage — using the wrong
 * input_type silently hurts recall. Vectors are L2-normalised so cosine similarity == dot product.
 */
export async function embed(
  texts: string[],
  inputType: EmbedInputType,
  attempts = inputType === "query" ? 2 : 4, // a visitor is waiting on queries; ingestion can afford to be patient
): Promise<number[][]> {
  const timeoutMs = inputType === "query" ? 8_000 : 20_000;
  const key = requireNvidiaKey();
  const body: Record<string, unknown> = {
    model: CONFIG.embedModel,
    input: texts,
    input_type: inputType,
    encoding_format: "float",
    truncate: "END",
  };
  if (CONFIG.embedDimensions) body.dimensions = CONFIG.embedDimensions;

  let lastErr = "";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(`${CONFIG.nimBaseUrl}/embeddings`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) {
        const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
        return json.data.sort((a, b) => a.index - b.index).map((d) => l2Normalize(d.embedding));
      }
      lastErr = `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`;
      // 4xx other than 429 will not get better by retrying.
      if (res.status !== 429 && res.status < 500) break;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    if (attempt < attempts) await sleep(attempt * 1500);
  }
  throw new Error(`Embedding request failed (${CONFIG.embedModel}): ${lastErr}`);
}
