-- Applied automatically by `npm run ingest` (which rewrites vector(N) to the model's real size).
-- You can also paste it into Supabase → SQL Editor. Re-runnable.

create extension if not exists vector;

create table if not exists public.chunks (
  id          text primary key,          -- content hash: unchanged text keeps its id
  source      text not null,             -- e.g. 03_ai_ntis.md
  doc_title   text not null,
  heading     text not null,
  chunk_index int  not null,
  content     text not null,
  embedding   vector(2048) not null,
  created_at  timestamptz not null default now()
);

-- The table itself is closed to the API roles: RLS on, no policies. Only the function below can read it.
alter table public.chunks enable row level security;

-- ~75 rows: an exact sequential scan is instant, so no ANN index (HNSW would only add recall risk,
-- and pgvector cannot index 2048-dim `vector` columns anyway).
drop function if exists public.match_chunks(vector, int);
create function public.match_chunks(query_embedding vector(2048), match_count int default 10)
returns table (
  id text, source text, doc_title text, heading text, chunk_index int, content text, similarity float
)
language sql stable
security definer
set search_path = public
as $$
  select c.id, c.source, c.doc_title, c.heading, c.chunk_index, c.content,
         1 - (c.embedding <=> query_embedding) as similarity   -- cosine similarity
  from public.chunks c
  order by c.embedding <=> query_embedding
  limit least(match_count, 20);
$$;

-- Read-only search over public portfolio content is the one thing the publishable (anon) key may do.
revoke all on function public.match_chunks(vector, int) from public;
grant execute on function public.match_chunks(vector, int) to anon, authenticated, service_role;
