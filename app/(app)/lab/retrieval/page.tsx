import { Suspense } from "react";

import { RetrievalArena } from "@/components/retrieval-arena/retrieval-arena";

export default function RetrievalArenaPage({ searchParams }: PageProps<"/lab/retrieval">) {
  return (
    <div className="mx-auto flex w-full max-w-[110rem] flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Retrieval arena</h1>
        <p className="text-muted-foreground text-sm">
          One query, four ways: nearest vectors, keyword full-text search, both fused with
          Reciprocal Rank Fusion, and the fused list reordered by a cross-encoder. Each column shows
          its own score and how far it moved each chunk.
        </p>
      </header>
      {/* The query string pre-loads a query from a lesson's "Try it" link. */}
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading…</p>}>
        <ArenaLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ArenaLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const str = (key: string) => (typeof p[key] === "string" ? (p[key] as string) : undefined);
  const k = Number(str("k"));
  return (
    <RetrievalArena
      initial={{
        q: str("q"),
        k: Number.isFinite(k) && k > 0 ? k : undefined,
        model: str("model"),
        rerank: str("rerank") === undefined ? undefined : str("rerank") !== "0",
      }}
    />
  );
}
