import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { lessons } from "@/content/learn/lessons";

export default function LearnPage() {
  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Learn</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        One lesson per concept, in course order. Each is written in the phase that builds it.
      </p>
      <ol className="mt-6 divide-y rounded-lg border">
        {lessons.map((lesson) => {
          const body = (
            <div className="flex items-start gap-4 p-4">
              <span className="text-muted-foreground w-6 shrink-0 text-right font-mono text-sm">
                {lesson.number}
              </span>
              <div className="flex-1">
                <div className="font-medium">{lesson.title}</div>
                <div className="text-muted-foreground text-sm">{lesson.summary}</div>
              </div>
              {!lesson.written && <Badge variant="outline">Phase {lesson.phase}</Badge>}
            </div>
          );
          return (
            <li key={lesson.slug}>
              {lesson.written ? (
                <Link href={`/learn/${lesson.slug}`} className="hover:bg-muted/50 block">
                  {body}
                </Link>
              ) : (
                <div className="opacity-60">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
