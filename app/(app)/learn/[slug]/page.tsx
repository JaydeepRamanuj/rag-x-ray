import { notFound } from "next/navigation";

import { lessons } from "@/content/learn/lessons";

export function generateStaticParams() {
  return lessons.filter((l) => l.written).map((l) => ({ slug: l.slug }));
}

export default async function LessonPage({ params }: PageProps<"/learn/[slug]">) {
  const { slug } = await params;
  // Cache Components drops `dynamicParams = false`, so unknown or unwritten
  // slugs are rejected here before the dynamic import can fail.
  if (!lessons.some((l) => l.slug === slug && l.written)) notFound();

  const { default: Lesson } = await import(`@/content/learn/${slug}.mdx`);

  return (
    <article className="prose prose-neutral dark:prose-invert mx-auto w-full max-w-3xl p-6">
      <Lesson />
    </article>
  );
}
