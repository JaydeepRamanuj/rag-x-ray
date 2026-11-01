import Link from "next/link";

import { SdkCompare } from "@/components/sdk-compare/sdk-compare";
import { loadComparison } from "@/lib/compare/sources";

export default async function LibraryComparisonPage() {
  const sides = await loadComparison();
  return (
    <div className="mx-auto flex w-full max-w-[110rem] flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Library comparison</h1>
        <p className="text-muted-foreground text-sm">
          Chat over your documents, written twice. The left side is what this app built by hand in
          phases 1 to 3: provider adapters, retries, an SSE encoder and parser. The right side is
          the same route on the Vercel AI SDK. Retrieval and the prompt builder are shared, so only
          the model call and the stream differ.{" "}
          <Link href="/learn/libraries-vs-hand-rolled" className="underline">
            Lesson 12
          </Link>{" "}
          walks through what the library hides.
        </p>
      </header>
      <SdkCompare sides={sides} />
    </div>
  );
}
