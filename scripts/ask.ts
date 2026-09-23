/** Ask the RAG pipeline from the terminal:  npm run ask -- "Did Hassam work with WebRTC?" "Has he worked at Google?" */
import { answerQuestion } from "../src/lib/rag/answer";

// Reserve providers (Gemini / Mistral / OpenRouter) have small free quotas: scripts leave them off unless --reserve.
if (!process.argv.includes("--reserve")) process.env.USE_RESERVE_LLMS = "0";

async function main() {
  const questions = process.argv.slice(2).filter((a) => a !== "--reserve");
  if (!questions.length) return console.log('Usage: npm run ask -- "your question" ["another question" ...]');
  for (const [i, q] of questions.entries()) {
    if (i) await new Promise((r) => setTimeout(r, 3000)); // stay under the free-tier rate limit
    const t0 = Date.now();
    let text = "";
    let meta = "";
    for await (const e of answerQuestion(q)) {
      if (e.type === "token") text += e.text;
      else if (e.type === "error") meta = `ERROR: ${e.message}`;
      else if (e.type === "done") {
        meta = `${e.refused ? "REFUSED" : "answered"} | top=${e.topScore?.toFixed(2)} | ${e.backend} | ${e.model ?? "no LLM call"} | sources: ${e.sources.map((s) => `${s.source}·${s.heading}`).join("; ") || "-"}`;
      }
    }
    console.log(`\nQ: ${q}\nA: ${text.trim() || "(none)"}\n   [${((Date.now() - t0) / 1000).toFixed(1)}s] ${meta}`);
  }
}
main();
