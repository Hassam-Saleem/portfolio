export const CONFIG = {
  nimBaseUrl: "https://integrate.api.nvidia.com/v1",
  embedModel: process.env.EMBED_MODEL || "nvidia/nemotron-3-embed-1b",
  embedDimensions: process.env.EMBED_DIMENSIONS ? Number(process.env.EMBED_DIMENSIONS) : undefined,
  // Tried in this order (models that recently failed are tried last). The llama-3.x models were retired 2026-08-26.
  chatModels: (
    process.env.CHAT_MODELS ||
    "mistralai/mistral-nemotron,nvidia/nemotron-3-ultra-550b-a55b,z-ai/glm-5.3-flash,moonshotai/kimi-k3,nvidia/nemotron-3.5-lightning-30b-a3b"
  )
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean),
  topK: Number(process.env.TOP_K || 10),
  // Below this cosine similarity for the best chunk, the question is out of scope -> refuse without an LLM call.
  minRelevance: Number(process.env.MIN_RELEVANCE || 0.15),
  // Chunking (characters)
  chunkTarget: 700,
  chunkMax: 1100,
  // Only these files are ingested. The dataset README is documentation about the corpus, not content about Hassam.
  corpusDir: "corpus",
  corpusIgnore: ["README.md"],
  indexPath: "data/index.json",
} as const;

export function requireNvidiaKey(): string {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new Error("NVIDIA_API_KEY is not set (server-side env var).");
  return key;
}

export interface ChatTarget {
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Extra request-body fields (e.g. switch a reasoning model's thinking off — a visitor wants an answer, not a chain of thought). */
  extra?: Record<string, unknown>;
  /** Extra HTTP headers (OpenRouter attribution). */
  headers?: Record<string, string>;
  /** Reserve providers are only tried after every primary model has been attempted, and are rate-capped (see answer.ts). */
  reserve?: boolean;
}

// Reserve providers, all on free tiers. Used strictly as a last resort so their small quotas last: they queue behind the
// NVIDIA models, are capped per hour, and scripts (eval / ask) leave them off unless --reserve is passed.
const RESERVES: {
  id: string;
  keyEnv: string;
  modelEnv: string;
  model: string;
  baseUrl: string;
  extra?: Record<string, unknown>;
  headers?: Record<string, string>;
}[] = [
  {
    id: "gemini",
    keyEnv: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    model: "gemini-2.5-flash",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    extra: { reasoning_effort: "none" },
  },
  { id: "mistral", keyEnv: "MISTRAL_API_KEY", modelEnv: "MISTRAL_MODEL", model: "mistral-small-latest", baseUrl: "https://api.mistral.ai/v1" },
  {
    id: "openrouter",
    keyEnv: "OPENROUTER_API_KEY",
    modelEnv: "OPENROUTER_MODEL",
    model: "google/gemma-4-31b-it:free",
    baseUrl: "https://openrouter.ai/api/v1",
    headers: { "X-Title": "Talk to Hassam", "HTTP-Referer": process.env.SITE_URL || "https://localhost" },
  },
];

// Per-model settings for the NVIDIA-hosted chat models. `keyEnv` names an optional dedicated key for that model;
// if it isn't set the main NVIDIA_API_KEY is used. Unlisted models are called with defaults and the main key.
const NO_THINKING = { chat_template_kwargs: { enable_thinking: false } };
const PROFILES: Record<string, { keyEnv?: string; extra?: Record<string, unknown> }> = {
  "mistralai/mistral-nemotron": {},
  "nvidia/nemotron-3-ultra-550b-a55b": { keyEnv: "NVIDIA_API_KEY_ULTRA", extra: NO_THINKING },
  "z-ai/glm-5.3-flash": { keyEnv: "NVIDIA_API_KEY_GLM", extra: NO_THINKING },
  "moonshotai/kimi-k3": { keyEnv: "NVIDIA_API_KEY_KIMI", extra: { reasoning_effort: "low" } },
  "nvidia/nemotron-3.5-lightning-30b-a3b": { keyEnv: "NVIDIA_API_KEY_LIGHTNING", extra: NO_THINKING },
};

/** NVIDIA models in order, then an optional second provider (any OpenAI-compatible API: Groq, OpenRouter, Gemini…). */
export function chatTargets(): ChatTarget[] {
  const targets: ChatTarget[] = CONFIG.chatModels.map((model) => {
    const profile = PROFILES[model] ?? {};
    return {
      label: model,
      baseUrl: CONFIG.nimBaseUrl,
      apiKey: (profile.keyEnv && process.env[profile.keyEnv]) || requireNvidiaKey(),
      model,
      extra: profile.extra,
    };
  });
  if (process.env.USE_RESERVE_LLMS === "0") return targets;

  for (const r of RESERVES) {
    const apiKey = process.env[r.keyEnv];
    const model = process.env[r.modelEnv] || r.model;
    if (!apiKey) continue;
    // A free OpenRouter key must never be pointed at a paid model.
    if (r.id === "openrouter" && !model.endsWith(":free")) {
      console.warn(`[config] ignoring OpenRouter model "${model}": only ":free" models are allowed (zero-budget rule).`);
      continue;
    }
    targets.push({ label: `${r.id}:${model}`, baseUrl: r.baseUrl, apiKey, model, extra: r.extra, headers: r.headers, reserve: true });
  }
  const { FALLBACK_LLM_BASE_URL: baseUrl, FALLBACK_LLM_API_KEY: apiKey, FALLBACK_LLM_MODEL: model } = process.env;
  if (baseUrl && apiKey && model) {
    targets.push({ label: `fallback:${model}`, baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, model, reserve: true });
  }
  return targets;
}
