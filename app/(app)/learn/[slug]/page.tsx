import { notFound } from "next/navigation";
import { Suspense } from "react";

import { lessons } from "@/content/learn/lessons";

export function generateStaticParams() {
  return lessons.filter((l) => l.written).map((l) => ({ slug: l.slug }));
}

export default function LessonPage({ params }: PageProps<"/learn/[slug]">) {
  // Reading params inside Suspense keeps the shell (sidebar, header)
  // instant on client navigation while the lesson body streams in.
  return (
    <article className="prose prose-neutral dark:prose-invert mx-auto w-full max-w-3xl p-6">
      <Suspense fallback={<p className="text-muted-foreground">Loading lesson…</p>}>
        <Lesson params={params} />
      </Suspense>
    </article>
  );
}

async function Lesson({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Cache Components drops `dynamicParams = false`, so unknown or unwritten
  // slugs are rejected here before the dynamic import can fail.
  if (!lessons.some((l) => l.slug === slug && l.written)) notFound();

  const { default: Content } = await import(`@/content/learn/${slug}.mdx`);
  return <Content />;
}
