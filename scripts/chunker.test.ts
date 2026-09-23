import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { chunkMarkdown } from "../src/lib/rag/chunker";
import { CONFIG } from "../src/lib/rag/config";

const opts = { target: CONFIG.chunkTarget, max: CONFIG.chunkMax };
const corpus = path.join(process.cwd(), CONFIG.corpusDir);
const files = fs.readdirSync(corpus).filter((f) => f.endsWith(".md") && !CONFIG.corpusIgnore.includes(f as never));

test("every corpus chunk is non-empty, bounded and carries its breadcrumb", () => {
  for (const f of files) {
    const chunks = chunkMarkdown(f, fs.readFileSync(path.join(corpus, f), "utf8"), opts);
    assert.ok(chunks.length > 0, `${f} produced no chunks`);
    for (const c of chunks) {
      assert.ok(c.content.length < CONFIG.chunkMax + 200, `${f} chunk too large: ${c.content.length}`);
      assert.ok(c.content.startsWith(c.docTitle), `${f} chunk is missing its doc-title breadcrumb`);
    }
  }
});

test("chunk ids are deterministic and unique", () => {
  const md = fs.readFileSync(path.join(corpus, files[0]), "utf8");
  const a = chunkMarkdown(files[0], md, opts);
  const b = chunkMarkdown(files[0], md, opts);
  assert.deepEqual(a.map((c) => c.id), b.map((c) => c.id));
  assert.equal(new Set(a.map((c) => c.id)).size, a.length);
});

test("no corpus text is lost by chunking", () => {
  for (const f of files) {
    const md = fs.readFileSync(path.join(corpus, f), "utf8");
    const joined = chunkMarkdown(f, md, opts).map((c) => c.content).join("\n");
    for (const line of md.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("# "))) {
      // A body-less H2 survives in every child chunk's "Doc > H2" breadcrumb rather than as a "## " line.
      const needle = line.replace(/^#{2,3}\s+/, "").trim();
      assert.ok(joined.includes(needle), `${f}: line lost → "${line.slice(0, 60)}"`);
    }
  }
});
