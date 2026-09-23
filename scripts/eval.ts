/**
 * Eval harness:  npm run eval
 *   npm run eval -- --retrieval-only     retrieval + relevance-gate scores only (no LLM calls; use to calibrate MIN_RELEVANCE)
 *   npm run eval -- --url https://your-app.vercel.app   score the deployed /api/chat instead of the local pipeline
 *   npm run eval -- --only refuse-google
 *   npm run eval -- --delay 4000          ms between questions (default 2500) — NVIDIA's free tier rate-limits (HTTP 429)
 *
 * Each case in eval/questions.json is either
 *   answerable → the expected source file must be among the cited sources AND every "mustContainAll" group
 *                (any-of synonyms) must appear in the answer AND it must not refuse;
 *   refusal    → the answer must decline (marker/gate, or a refusal phrase) AND match none of "mustNotMatch".
 * Exit code is 1 if any case fails, so it can gate a change to the prompt / chunking / model.
 */
import fs from "node:fs";
import path from "node:path";
import { answerQuestion } from "../src/lib/rag/answer";
import { CONFIG } from "../src/lib/rag/config";
import { retrieve } from "../src/lib/rag/retrieve";
import type { RagEvent } from "../src/lib/rag/types";

interface Case {
  id: string;
  question: string;
  type: "answerable" | "refusal";
  expectedSource: string | string[] | null;
  mustContainAll: string[][];
  mustNotMatch: string[];
}

// Reserve providers (Gemini / Mistral / OpenRouter) have small free quotas: the eval leaves them off unless --reserve.
if (!process.argv.includes("--reserve")) process.env.USE_RESERVE_LLMS = "0";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const retrievalOnly = flag("--retrieval-only");
const baseUrl = opt("--url")?.replace(/\/$/, "");
const only = opt("--only");

const REFUSAL_PHRASES =
  /(don't have|do not have|not documented|doesn't (document|cover|contain|mention)|does not (document|cover|contain|mention)|no (information|evidence)|can't (confirm|answer)|cannot (confirm|answer)|not (available|enough information)|only answer)/i;

async function run(question: string): Promise<{ text: string; done?: Extract<RagEvent, { type: "done" }>; error?: string }> {
  let text = "";
  let done: Extract<RagEvent, { type: "done" }> | undefined;
  let error: string | undefined;
  const handle = (e: RagEvent) => {
    if (e.type === "token") text += e.text;
    else if (e.type === "done") done = e;
    else if (e.type === "error") error = e.message;
  };

  if (baseUrl) {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: question }] }),
    });
    if (!res.ok || !res.body) return { text, error: `HTTP ${res.status}` };
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done: d, value } = await reader.read();
      if (d) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const l of lines) if (l.trim()) handle(JSON.parse(l));
    }
  } else {
    for await (const e of answerQuestion(question)) handle(e);
  }
  return { text: text.trim(), done, error };
}

const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length));

async function main() {
  const cases: Case[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "eval/questions.json"), "utf8"));
  const onlyIds = only?.split(",");
  const selected = onlyIds ? cases.filter((c) => onlyIds.includes(c.id)) : cases;

  if (retrievalOnly) {
    console.log(`Retrieval-only. Gate: MIN_RELEVANCE=${CONFIG.minRelevance}, top-k=${CONFIG.topK}\n`);
    console.log(pad("id", 26), pad("type", 11), pad("top", 6), pad("gate", 8), "top-3 sources");
    let failures = 0;
    const scores = { answerable: [] as number[], refusal: [] as number[] };
    for (const c of selected) {
      const { chunks } = await retrieve(c.question);
      const top = chunks[0]?.score ?? 0;
      scores[c.type].push(top);
      const passes = top >= CONFIG.minRelevance;
      const hit = c.expectedSource ? chunks.slice(0, 3).some((x) => [c.expectedSource!].flat().includes(x.source)) : true;
      const ok = c.type === "answerable" ? passes && hit : true; // refusals are allowed to pass the gate; the LLM handles those
      if (!ok) failures++;
      console.log(
        pad(c.id, 26),
        pad(c.type, 11),
        pad(top.toFixed(3), 6),
        pad(passes ? "pass" : "REFUSE", 8),
        chunks.slice(0, 3).map((x) => x.source.slice(0, 2)).join(","),
        c.type === "answerable" ? (hit ? "hit@3 ✓" : "hit@3 ✗ MISS") : "",
      );
    }
    const min = (a: number[]) => (a.length ? Math.min(...a).toFixed(3) : "-");
    const max = (a: number[]) => (a.length ? Math.max(...a).toFixed(3) : "-");
    console.log(`\nanswerable top-score min ${min(scores.answerable)} | refusal top-score max ${max(scores.refusal)}`);
    console.log("Pick MIN_RELEVANCE below the answerable minimum; anything above it is left to the LLM's [NO_INFO] refusal.");
    process.exit(failures ? 1 : 0);
  }

  const results: Record<string, unknown>[] = [];
  let passed = 0;
  for (const c of selected) {
    if (results.length) await new Promise((r) => setTimeout(r, Number(opt("--delay") ?? 2500))); // stay under the free-tier rate limit
    const t0 = Date.now();
    const { text, done, error } = await run(c.question);
    const lower = text.toLowerCase();
    const problems: string[] = [];

    if (error) problems.push(`LLM unavailable / error: ${error}`);
    if (c.type === "answerable") {
      if (done?.refused) problems.push("refused an answerable question");
      // The assistant speaks as Hassam, so an answer must not slip back into the third person.
      if (/\b(hassam|he|his|him)\b/i.test(text)) problems.push("answered in the third person");
      if (c.expectedSource && !done?.sources.some((s) => [c.expectedSource!].flat().includes(s.source))) {
        problems.push(`expected source ${[c.expectedSource].flat().join(" or ")} not cited`);
      }
      for (const group of c.mustContainAll) {
        if (!group.some((w) => lower.includes(w.toLowerCase()))) problems.push(`missing any of [${group.join(" | ")}]`);
      }
    } else {
      const refused = done?.refused || REFUSAL_PHRASES.test(text);
      if (!refused) problems.push("did not refuse");
    }
    for (const pattern of c.mustNotMatch) {
      if (new RegExp(pattern, "i").test(text)) problems.push(`matched forbidden /${pattern}/`);
    }

    const ok = problems.length === 0;
    if (ok) passed++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${pad(c.id, 26)} ${((Date.now() - t0) / 1000).toFixed(1)}s  top=${done?.topScore?.toFixed(2) ?? "-"} model=${done?.model ?? "-"}`);
    if (!ok) console.log(`      ${problems.join("; ")}\n      answer: ${text.replace(/\s+/g, " ").slice(0, 240)}`);
    results.push({ id: c.id, type: c.type, ok, problems, answer: text, done });
  }

  const refusalCases = selected.filter((c) => c.type === "refusal");
  const refusalPassed = results.filter((r) => r.type === "refusal" && r.ok).length;
  console.log(`\nScore: ${passed}/${selected.length} passed  |  grounded refusal: ${refusalPassed}/${refusalCases.length}`);
  fs.writeFileSync(path.join(process.cwd(), "eval/last-results.json"), JSON.stringify({ ranAt: new Date().toISOString(), target: baseUrl ?? "local", passed, total: selected.length, results }, null, 2));
  process.exit(passed === selected.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
