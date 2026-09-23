import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The JSON vector snapshot is read with fs at runtime (fallback when Supabase is unreachable),
  // so tell Vercel's file tracer to ship it with the chat function.
  outputFileTracingIncludes: {
    "/api/chat": ["./data/index.json"],
  },
};

export default nextConfig;
