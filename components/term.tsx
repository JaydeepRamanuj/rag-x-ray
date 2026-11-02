"use client";

import { Popover } from "@base-ui/react/popover";

import { glossaryById } from "@/content/glossary";
import { cn } from "@/lib/utils";

/**
 * A jargon word with a dotted underline. Hover (or tap, on a phone) shows its
 * plain-words definition from content/glossary.ts. A popover rather than a
 * tooltip, because tooltips don't open on touch.
 */
export function Term({
  id,
  children,
  className,
}: {
  id: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const entry = glossaryById.get(id);
  // A typo in an id should show up in development, not silently drop the text.
  if (!entry) {
    if (process.env.NODE_ENV !== "production") throw new Error(`Unknown glossary term "${id}"`);
    return <>{children}</>;
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={150}
        className={cn(
          "decoration-muted-foreground/60 hover:decoration-foreground cursor-help underline decoration-dotted underline-offset-[3px]",
          className,
        )}
      >
        {children ?? inline(entry.term)}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} className="isolate z-50">
          <Popover.Popup className="bg-popover text-popover-foreground data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 w-72 rounded-lg border p-3 text-left text-sm font-normal normal-case shadow-md">
            <div className="font-medium">{entry.term}</div>
            <p className="text-muted-foreground mt-1 leading-snug">{entry.short}</p>
            {/* A plain anchor: Term is also used inside MDX lessons, where
                next/link can't be resolved (see mdx-components.tsx). */}
            <a
              href={`/learn/glossary#${entry.id}`}
              className="mt-2 inline-block text-xs underline underline-offset-2"
            >
              More in the glossary
            </a>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * A term as it reads mid-sentence: "Reranking" becomes "reranking", while
 * acronyms ("TTFT", "HNSW index") keep their capitals.
 */
function inline(term: string) {
  return /^[A-Z][A-Z]/.test(term) ? term : term[0].toLowerCase() + term.slice(1);
}
