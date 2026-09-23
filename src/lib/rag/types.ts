export interface Chunk {
  id: string;
  source: string; // file name, e.g. 03_ai_ntis.md
  docTitle: string; // the document's H1
  heading: string; // "H2" or "H2 > H3 ..." path inside the document
  chunkIndex: number;
  content: string; // exact text embedded and shown to the LLM
}

export interface EmbeddedChunk extends Chunk {
  embedding: number[];
}

export interface ScoredChunk extends Chunk {
  score: number; // cosine similarity, 1 = identical
}

export interface Source {
  source: string;
  docTitle: string;
  heading: string;
}

export interface IndexFile {
  model: string;
  dimensions: number;
  createdAt: string;
  chunks: EmbeddedChunk[];
}

export type ChatRole = "user" | "assistant";
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export type RagEvent =
  | { type: "status"; stage: "retrieving" | "generating" }
  | { type: "token"; text: string }
  | {
      type: "done";
      refused: boolean;
      sources: Source[];
      model: string | null;
      topScore: number | null;
      backend: "supabase" | "json" | null;
    }
  | { type: "error"; message: string };
