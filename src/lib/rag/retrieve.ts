import { CONFIG } from "./config";
import { embed } from "./embed";
import { getSupabase, searchJson, searchSupabase } from "./store";
import type { ScoredChunk } from "./types";

export interface Retrieval {
  chunks: ScoredChunk[];
  backend: "supabase" | "json";
}

/**
 * Embed the query, then cosine top-k from Supabase pgvector. If Supabase is unset, paused
 * (free tier) or errors, fall back to the committed JSON snapshot so the site keeps answering.
 */
export async function retrieve(query: string, k: number = CONFIG.topK): Promise<Retrieval> {
  const [queryEmbedding] = await embed([query], "query");

  if (getSupabase()) {
    try {
      return { chunks: await searchSupabase(queryEmbedding, k), backend: "supabase" };
    } catch (e) {
      console.warn("[retrieve] Supabase failed, using JSON snapshot:", e instanceof Error ? e.message : e);
    }
  }
  return { chunks: searchJson(queryEmbedding, k), backend: "json" };
}
