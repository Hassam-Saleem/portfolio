/**
 * Re-runnable ingestion:  npm run ingest   (add --force to re-embed everything, --json-only to skip Supabase)
 *
 *   corpus/*.md → chunk → embed (passage) → data/index.json (snapshot) + Supabase pgvector (if configured)
 *
 * Idempotent: chunk ids are content hashes, so unchanged chunks reuse their stored vectors and are not
 * re-embedded; chunks that disappeared from the corpus are deleted from Supabase. Add or edit a file in
 * corpus/, run this again, done.
 */
import fs from "node:fs";
import path from "node:path";
import { chunkMarkdown } from "../src/lib/rag/chunker";
import { CONFIG } from "../src/lib/rag/config";
import { embed } from "../src/lib/rag/embed";
import pg from "pg";
import { loadIndex, writeIndex } from "../src/lib/rag/store";
import type { Chunk, EmbeddedChunk } from "../src/lib/rag/types";

const force = process.argv.includes("--force");
const jsonOnly = process.argv.includes("--json-only");
const BATCH = 16;
const round = (v: number[]) => v.map((x) => Math.round(x * 1e6) / 1e6);

async function main() {
  const dir = path.join(process.cwd(), CONFIG.corpusDir);
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !(CONFIG.corpusIgnore as readonly string[]).includes(f))
    .sort();
  if (!files.length) throw new Error(`No .md files found in ${dir}`);

  const chunks: Chunk[] = files.flatMap((f) =>
    chunkMarkdown(f, fs.readFileSync(path.join(dir, f), "utf8"), { target: CONFIG.chunkTarget, max: CONFIG.chunkMax }),
  );
  const sizes = chunks.map((c) => c.content.length);
  console.log(
    `Corpus: ${files.length} files → ${chunks.length} chunks (chars: min ${Math.min(...sizes)}, avg ${Math.round(
      sizes.reduce((a, b) => a + b, 0) / sizes.length,
    )}, max ${Math.max(...sizes)})`,
  );

  // Reuse vectors for unchanged chunks — but only if they came from the same model/dimensions.
  const prev = force ? null : loadIndex(true);
  const reusable =
    prev && prev.model === CONFIG.embedModel && (!CONFIG.embedDimensions || prev.dimensions === CONFIG.embedDimensions)
      ? new Map(prev.chunks.map((c) => [c.id, c.embedding]))
      : new Map<string, number[]>();

  const todo = chunks.filter((c) => !reusable.has(c.id));
  console.log(`Embedding ${todo.length} new/changed chunks with ${CONFIG.embedModel} (${chunks.length - todo.length} reused)…`);

  const fresh = new Map<string, number[]>();
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const vectors = await embed(batch.map((c) => c.content), "passage");
    batch.forEach((c, j) => fresh.set(c.id, round(vectors[j])));
    console.log(`  embedded ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
    if (i + BATCH < todo.length) await new Promise((r) => setTimeout(r, 300));
  }

  const embedded: EmbeddedChunk[] = chunks.map((c) => ({ ...c, embedding: fresh.get(c.id) ?? reusable.get(c.id)! }));
  const dimensions = embedded[0].embedding.length;
  writeIndex({ model: CONFIG.embedModel, dimensions, createdAt: new Date().toISOString(), chunks: embedded });
  console.log(`Wrote ${CONFIG.indexPath} (${dimensions}-dim vectors).`);

  if (jsonOnly) return console.log("--json-only: skipped Postgres.");
  if (!process.env.DATABASE_URL) {
    return console.log("DATABASE_URL not set: skipped Supabase (the app will use data/index.json).");
  }
  try {
    const { upserted, deleted } = await syncPostgres(embedded, dimensions);
    console.log(`Supabase pgvector: upserted ${upserted} chunks, deleted ${deleted} stale.`);
  } catch (e) {
    console.error(`\nSupabase sync failed: ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  }
}

/** Apply supabase/schema.sql (vector size rewritten to match the model), then make the table mirror the corpus exactly. */
async function syncPostgres(chunks: EmbeddedChunk[], dimensions: number) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    // The table holds derived data only, so if the embedding size changed, dropping it is safe — ingestion refills it.
    const { rows } = await client.query(
      `select a.atttypmod as dims from pg_attribute a
         where a.attrelid = to_regclass('public.chunks') and a.attname = 'embedding'`,
    );
    if (rows[0] && rows[0].dims !== dimensions) {
      console.log(`Existing table has vector(${rows[0].dims}); recreating as vector(${dimensions}).`);
      await client.query("drop table public.chunks");
    }
    const schema = fs.readFileSync(path.join(process.cwd(), "supabase/schema.sql"), "utf8");
    await client.query(schema.replace(/vector\(\d+\)/g, `vector(${dimensions})`));

    await client.query("begin");
    for (const c of chunks) {
      await client.query(
        `insert into public.chunks (id, source, doc_title, heading, chunk_index, content, embedding)
         values ($1, $2, $3, $4, $5, $6, $7::vector)
         on conflict (id) do update set source = excluded.source, doc_title = excluded.doc_title,
           heading = excluded.heading, chunk_index = excluded.chunk_index, content = excluded.content,
           embedding = excluded.embedding`,
        [c.id, c.source, c.docTitle, c.heading, c.chunkIndex, c.content, `[${c.embedding.join(",")}]`],
      );
    }
    const del = await client.query("delete from public.chunks where id <> all($1::text[])", [chunks.map((c) => c.id)]);
    await client.query("commit");
    return { upserted: chunks.length, deleted: del.rowCount ?? 0 };
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
