"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight, Check, CircleHelp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { guideFor } from "@/content/guides";
import type { Guide, Item } from "@/content/guides/types";
import { lessons } from "@/content/learn/lessons";
import { cn } from "@/lib/utils";

import { openOnFirstVisit, setGuideOpen, toggleStep, useGuideState } from "./guide-store";

/** The "How to use this page" button in the top bar. Hidden on pages without a guide. */
export function GuideButton() {
  const guide = guideFor(usePathname());
  const { open } = useGuideState();
  if (!guide) return null;
  return (
    <Button
      variant={open ? "secondary" : "outline"}
      size="sm"
      className="ml-auto"
      onClick={() => setGuideOpen(!open)}
      aria-expanded={open}
      aria-controls="page-guide"
    >
      <CircleHelp /> How to use this page
    </Button>
  );
}

/**
 * The guide beside the page. On wide screens it sits next to the content and
 * scrolls on its own, so you can follow the steps while using the tool; on
 * narrow ones it slides over the page.
 */
export function GuidePanel() {
  const pathname = usePathname();
  const guide = guideFor(pathname);
  const { open, done } = useGuideState();

  useEffect(() => {
    if (guide) openOnFirstVisit(guide.title);
  }, [guide]);

  if (!guide || !open) return null;
  const ticked = done[guide.title] ?? [];

  return (
    <aside
      id="page-guide"
      aria-label={`How to use: ${guide.title}`}
      className="bg-background fixed inset-y-0 right-0 z-40 flex w-[min(26rem,100vw)] flex-col border-l shadow-xl lg:sticky lg:top-0 lg:h-svh lg:shrink-0 lg:shadow-none"
    >
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <div className="text-muted-foreground text-xs">How to use</div>
          <h2 className="font-semibold">{guide.title}</h2>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setGuideOpen(false)}
          aria-label="Close guide"
        >
          <X />
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-3 text-sm leading-relaxed">
        <div className="flex flex-col gap-2">{guide.summary}</div>

        <Section title="Why this exists">
          <div className="flex flex-col gap-2">{guide.why}</div>
        </Section>

        <Section title="What you can change">
          <Items items={guide.inputs} />
        </Section>

        <Section title={`Try this (${ticked.length}/${guide.steps.length})`}>
          <ol className="flex flex-col gap-3">
            {guide.steps.map((step, i) => {
              const isDone = ticked.includes(i);
              return (
                <li key={i} className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => toggleStep(guide.title, i)}
                    aria-pressed={isDone}
                    aria-label={`Step ${i + 1} ${isDone ? "done" : "not done"}`}
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                      isDone && "bg-primary text-primary-foreground border-primary",
                    )}
                  >
                    {isDone ? <Check className="size-3.5" /> : i + 1}
                  </button>
                  <div className={cn("flex flex-col gap-1", isDone && "opacity-60")}>
                    <div>{step.do}</div>
                    <div className="text-muted-foreground border-l-2 pl-3">
                      <span className="text-foreground/80 font-medium">You should see: </span>
                      {step.see}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>

        <Section title="Reading the result">
          <Items items={guide.reading} />
        </Section>

        <Section title="Pros and cons">
          <div className="flex flex-col gap-3">
            <ProsCons label="Good at" items={guide.pros} mark="+" />
            <ProsCons label="Watch out for" items={guide.cons} mark="−" />
          </div>
        </Section>

        <Section title="Things that look wrong but aren't">
          <ul className="flex list-disc flex-col gap-2 pl-4">
            {guide.surprises.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Section>

        <Section title="Learn more">
          <Footer guide={guide} />
        </Section>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details open className="group border-t pt-2 first-of-type:mt-3">
      <summary className="text-muted-foreground hover:text-foreground cursor-pointer py-1 text-xs font-semibold tracking-wide uppercase">
        {title}
      </summary>
      <div className="pt-1 pb-3">{children}</div>
    </details>
  );
}

function Items({ items }: { items: Item[] }) {
  return (
    <dl className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <div key={i}>
          <dt className="font-medium">{item.name}</dt>
          <dd className="text-muted-foreground">{item.what}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProsCons({
  label,
  items,
  mark,
}: {
  label: string;
  items: React.ReactNode[];
  mark: string;
}) {
  return (
    <div>
      <div className="font-medium">{label}</div>
      <ul className="mt-1 flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-muted-foreground flex gap-2">
            <span className="text-foreground w-3 shrink-0 font-mono">{mark}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Footer({ guide }: { guide: Guide }) {
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1">
        {guide.lessons.map((slug) => {
          const lesson = lessons.find((l) => l.slug === slug);
          return (
            <li key={slug}>
              <Link href={`/learn/${slug}`} className="underline underline-offset-2">
                Lesson {lesson?.number}: {lesson?.title}
              </Link>
            </li>
          );
        })}
        <li>
          <Link href="/learn/glossary" className="underline underline-offset-2">
            Glossary
          </Link>
          <span className="text-muted-foreground">: every term in plain words</span>
        </li>
      </ul>
      {guide.next && (
        <Link
          href={guide.next.href}
          className="bg-muted/60 hover:bg-muted mt-1 flex items-center justify-between rounded-md px-3 py-2"
        >
          <span>
            <span className="text-muted-foreground text-xs">Next in the tour</span>
            <br />
            {guide.next.label}
          </span>
          <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
