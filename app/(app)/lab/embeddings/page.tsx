import { Suspense } from "react";

import { EmbeddingExplorer } from "@/components/embedding-explorer/embedding-explorer";
import { SimilarityPlayground } from "@/components/embedding-explorer/similarity-playground";
import { Term } from "@/components/term";

export default function EmbeddingExplorerPage({ searchParams }: PageProps<"/lab/embeddings">) {
  return (
    <div className="mx-auto flex w-full max-w-[110rem] flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Embedding explorer</h1>
        <p className="text-muted-foreground text-sm">
          Every active chunk as a dot, its 768 (or 384) <Term id="embedding">numbers</Term> squashed
          into two so you can see them. Colour is the document. Place a query to see where retrieval
          would look, then check whether the <Term id="projection">map</Term> agrees with the real
          nearest neighbours.
        </p>
      </header>
      {/* The query string pre-loads settings from a lesson's "Try it" link. */}
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading…</p>}>
        <ExplorerLoader searchParams={searchParams} />
      </Suspense>
      <SimilarityPlayground />
    </div>
  );
}

async function ExplorerLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const str = (key: string) => (typeof p[key] === "string" ? (p[key] as string) : undefined);
  return (
    <EmbeddingExplorer
      initial={{
        q: str("q"),
        model: str("model"),
        dims: Number(str("dims")) || undefined,
        proj: str("proj"),
      }}
    />
  );
}
