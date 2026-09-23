import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CONFIG } from "./config";
import type { IndexFile, ScoredChunk } from "./types";

/* ------------------------------ Supabase pgvector ------------------------------ */

let sbClient: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (sbClient !== undefined) return sbClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  sbClient = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return sbClient;
}

interface MatchRow {
  id: string;
  source: string;
  doc_title: string;
  heading: string;
  chunk_index: number;
  content: string;
  similarity: number;
}

export async function searchSupabase(queryEmbedding: number[], k: number): Promise<ScoredChunk[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase is not configured");
  const { data, error } = await sb
    .rpc("match_chunks", { query_embedding: queryEmbedding, match_count: k })
    .abortSignal(AbortSignal.timeout(6_000));
  if (error) throw new Error(`Supabase match_chunks failed: ${error.message}`);
  return ((data ?? []) as MatchRow[]).map((r) => ({
    id: r.id,
    source: r.source,
    docTitle: r.doc_title,
    heading: r.heading,
    chunkIndex: r.chunk_index,
    content: r.content,
    score: r.similarity,
  }));
}

/* ------------------------- JSON snapshot (in-memory cosine) ------------------------- */

// Statically scoped path so the bundler can trace data/index.json into the serverless function.
const indexFile = () => path.join(process.cwd(), "data", "index.json");
let cachedIndex: IndexFile | null | undefined;

export function loadIndex(fresh = false): IndexFile | null {
  if (!fresh && cachedIndex !== undefined) return cachedIndex;
  try {
    cachedIndex = JSON.parse(fs.readFileSync(indexFile(), "utf8")) as IndexFile;
  } catch {
    cachedIndex = null;
  }
  return cachedIndex;
}

export function writeIndex(index: IndexFile): void {
  fs.mkdirSync(path.dirname(indexFile()), { recursive: true });
  fs.writeFileSync(indexFile(), JSON.stringify(index));
  cachedIndex = index;
}

export function searchJson(queryEmbedding: number[], k: number): ScoredChunk[] {
  const index = loadIndex();
  if (!index) throw new Error(`No vector index found at ${CONFIG.indexPath}. Run \`npm run ingest\`.`);
  if (index.chunks[0] && index.chunks[0].embedding.length !== queryEmbedding.length) {
    throw new Error(
      `Index has ${index.chunks[0].embedding.length}-dim vectors (${index.model}) but queries are ${queryEmbedding.length}-dim. Re-run \`npm run ingest\`.`,
    );
  }
  // Vectors are L2-normalised at embed time, so cosine similarity == dot product.
  return index.chunks
    .map(({ embedding, ...chunk }) => {
      let dot = 0;
      for (let i = 0; i < embedding.length; i++) dot += embedding[i] * queryEmbedding[i];
      return { ...chunk, score: dot };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
