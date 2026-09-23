import { createHash } from "node:crypto";
import type { Chunk } from "./types";

interface Leaf {
  h2: string;
  path: string; // "H2" or "H2 > H3"
  text: string; // heading line(s) + body, as written in the source
}

export interface ChunkOptions {
  target: number;
  max: number;
}

/**
 * Markdown-aware chunker.
 *  1. Split the file at H2/H3 headings into "leaf" sections (heading line stays in the text, so a
 *     FAQ question travels with its answer).
 *  2. Greedily pack consecutive leaves under the same H2 up to `target` chars — tiny sections are
 *     merged instead of becoming near-empty vectors.
 *  3. A single leaf longer than `max` is split on paragraph / list-line boundaries with one block of overlap.
 *  4. Every chunk is prefixed with "Doc title > H2" so it is self-describing when retrieved alone.
 * Chunk ids are content hashes: unchanged text keeps its id, which lets ingestion skip re-embedding.
 */
export function chunkMarkdown(source: string, markdown: string, opts: ChunkOptions): Chunk[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let docTitle = source;
  let h2 = "";
  let h3 = "";
  const leaves: Leaf[] = [];
  let buf: string[] = [];
  let bufHeadingLines: string[] = [];

  const flush = () => {
    const body = buf.join("\n").trim();
    if (body) {
      const path = h3 ? `${h2} > ${h3}` : h2 || docTitle;
      leaves.push({ h2: h2 || docTitle, path, text: [...bufHeadingLines, body].join("\n") });
    }
    buf = [];
    bufHeadingLines = [];
  };

  for (const line of lines) {
    const m = /^(#{1,3})\s+(.*)$/.exec(line);
    if (m) {
      const level = m[1].length;
      const title = m[2].trim();
      if (level === 1) {
        flush();
        docTitle = title;
        h2 = "";
        h3 = "";
        continue;
      }
      flush();
      if (level === 2) {
        h2 = title;
        h3 = "";
        bufHeadingLines = [`## ${title}`];
      } else {
        h3 = title;
        bufHeadingLines = [`### ${title}`];
      }
      continue;
    }
    buf.push(line);
  }
  flush();

  // Expand oversized leaves, then pack per H2.
  const pieces: Leaf[] = leaves.flatMap((leaf) =>
    leaf.text.length > opts.max
      ? splitLong(leaf.text, opts).map((text) => ({ ...leaf, text }))
      : [leaf],
  );

  const chunks: Chunk[] = [];
  let group: Leaf[] = [];
  let groupLen = 0;
  const emit = () => {
    if (!group.length) return;
    const h2Title = group[0].h2;
    const paths = [...new Set(group.map((l) => l.path))];
    const heading = paths.length > 1 ? h2Title : paths[0];
    const content = `${docTitle} > ${h2Title}\n\n${group.map((l) => l.text).join("\n\n")}`;
    chunks.push({
      id: createHash("sha1").update(`${source}\0${content}`).digest("hex").slice(0, 16),
      source,
      docTitle,
      heading,
      chunkIndex: chunks.length,
      content,
    });
    group = [];
    groupLen = 0;
  };

  for (const piece of pieces) {
    const sameH2 = group.length === 0 || group[0].h2 === piece.h2;
    if (!sameH2 || (group.length > 0 && groupLen + piece.text.length > opts.target)) emit();
    group.push(piece);
    groupLen += piece.text.length + 2;
  }
  emit();
  return chunks;
}

function splitLong(text: string, opts: ChunkOptions): string[] {
  const lines = text.split("\n");
  const headingLine = /^#{2,3}\s/.test(lines[0]) ? lines[0] : "";
  const bodyLines = headingLine ? lines.slice(1) : lines;

  // Blocks = paragraphs; a block that is itself too long (long bullet list) is split per line.
  const blocks: string[] = [];
  for (const para of bodyLines.join("\n").split(/\n{2,}/)) {
    if (para.length <= opts.target) blocks.push(para);
    else blocks.push(...para.split("\n"));
  }

  const out: string[] = [];
  let cur: string[] = [];
  let len = 0;
  for (const block of blocks) {
    if (cur.length && len + block.length > opts.target) {
      out.push(cur.join("\n"));
      const overlap = cur[cur.length - 1];
      cur = [overlap];
      len = overlap.length;
    }
    cur.push(block);
    len += block.length + 1;
  }
  if (cur.length) out.push(cur.join("\n"));
  return out.map((body) => (headingLine ? `${headingLine}\n${body}` : body).trim());
}
