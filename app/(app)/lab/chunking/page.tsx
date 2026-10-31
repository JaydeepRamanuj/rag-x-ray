import Link from "next/link";
import { Suspense } from "react";

import { ChunkingLab } from "@/components/chunking-lab/chunking-lab";

export default function ChunkingLabPage({ searchParams }: PageProps<"/lab/chunking">) {
  return (
    <div className="mx-auto flex w-full max-w-[110rem] flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Chunking lab</h1>
        <p className="text-muted-foreground text-sm">
          One document split four ways with the same settings. Each chunk is tinted, overlaps are
          darker, and ✂ marks a cut through a word. Previews are computed in memory; nothing is
          stored until you save a set. See{" "}
          <Link href="/learn/chunking" className="underline">
            Lesson 5
          </Link>
          .
        </p>
      </header>
      {/* The query string pre-loads settings from a lesson's "Try it" link. */}
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading…</p>}>
        <LabLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LabLoader({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const num = (key: string) => {
    const v = params[key];
    const n = typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : undefined;
  };
  const doc = typeof params.doc === "string" ? params.doc : undefined;
  return (
    <ChunkingLab
      initial={{ doc, size: num("size"), overlap: num("overlap"), threshold: num("threshold") }}
    />
  );
}
