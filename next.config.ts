import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Lets Learn lessons in content/learn/*.mdx be imported as React components.
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // The library comparison page shows these files' source, read from disk.
  outputFileTracingIncludes: {
    "/lab/sdk": [
      "./app/api/chat/route.ts",
      "./app/api/chat-sdk/route.ts",
      "./lib/llm/*.ts",
      "./lib/sse/*.ts",
      "./lib/chat/events.ts",
    ],
  },
  // Chat is the home page. A config redirect happens before rendering, so
  // there's no empty "/" page to prerender.
  async redirects() {
    return [{ source: "/", destination: "/chat", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withMDX = createMDX({
  options: {
    // GitHub-flavoured markdown: tables, strikethrough, autolinks. Turbopack
    // needs plugins named as strings, not imported functions.
    remarkPlugins: ["remark-gfm"],
  },
});

export default withMDX(nextConfig);
