"use client";

import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { exampleRun as run } from "@/content/learn/example-run";
import { lessons } from "@/content/learn/lessons";
import { chatModels, defaults, embeddingModels, rerankModel } from "@/lib/config";
import { formatInt } from "@/lib/format";

import { Arrow, Box, columns, ink, Svg, Text, wash, type Tone } from "./diagrams/kit";

// Same grid as Part A's two-flows figure: 7 columns, indexing on top, the
// question underneath, joined at the vector store.
const BW = 88;
const col = columns(7, BW);
const mid = (i: number) => col(i) + BW / 2;
const ROW1 = 30;
const ROW2 = 228;
const H = 56;
const STORE = { x: mid(2) - 72, y: 130, w: 144, h: 50 };

type Stage = {
  flow: "index" | "ask";
  title: string;
  sub: string;
  box: { x: number; y: number; w: number; h: number };
  sentence: string;
  lesson: string;
  tool: { href: string; label: string };
  /** Extra detail under the sentence: the run's sources or its answer. */
  show?: "question" | "sources" | "answer";
};

const runPage = `/runs/${run.id}`;
const row = (y: number) => (i: number) => ({ x: col(i), y, w: BW, h: H });
const top = row(ROW1);
const bottom = row(ROW2);

const stages: Stage[] = [
  {
    flow: "index",
    title: "Document",
    sub: `${formatInt(run.document.tokens)} tokens`,
    box: top(0),
    sentence: `A file is uploaded once and its text pulled out: here ${run.document.title}, ${formatInt(run.document.tokens)} tokens long.`,
    lesson: "tokens",
    tool: { href: "/documents", label: "Documents" },
  },
  {
    flow: "index",
    title: "Chunk",
    sub: `${run.document.chunks} × ≤${defaults.chunkSize}`,
    box: top(1),
    sentence: `It is cut into ${run.document.chunks} chunks of up to ${defaults.chunkSize} tokens. Each shares ${defaults.chunkOverlap} tokens with the one before, so a sentence cut at a boundary is still whole in one of them.`,
    lesson: "chunking",
    tool: { href: "/lab/chunking", label: "Chunking lab" },
  },
  {
    flow: "index",
    title: "Embed",
    sub: `${embeddingModels.gemini.dimensions} numbers`,
    box: top(2),
    sentence: `${embeddingModels.gemini.label} turns each chunk into ${embeddingModels.gemini.dimensions} numbers. Chunks that mean similar things get similar numbers.`,
    lesson: "embeddings",
    tool: { href: "/lab/embeddings", label: "Embedding explorer" },
  },
  {
    flow: "index",
    title: "Vector store",
    sub: "Neon + pgvector",
    box: STORE,
    sentence:
      "Chunks and their vectors are saved in Postgres on Neon, with an HNSW index for the vectors and a full-text index for the words. This is where the two flows meet.",
    lesson: "vector-databases",
    tool: { href: "/documents", label: "Documents" },
  },
  {
    flow: "ask",
    title: "Question",
    sub: `${run.questionTokens} tokens`,
    box: bottom(0),
    sentence: `Someone asks a question in chat: ${run.questionTokens} tokens.`,
    lesson: "llm-api-call",
    tool: { href: "/chat", label: "Chat" },
    show: "question",
  },
  {
    flow: "ask",
    title: "Embed",
    sub: `${formatInt(run.ms.embed)} ms`,
    box: bottom(1),
    sentence: `The question is embedded with the same model, so it lands among the chunks it is about. ${formatInt(run.ms.embed)} ms with nothing cached.`,
    lesson: "embeddings",
    tool: { href: "/lab/embeddings", label: "Embedding explorer" },
    show: "question",
  },
  {
    flow: "ask",
    title: "Search",
    sub: `${formatInt(run.ms.search)} ms`,
    box: bottom(2),
    sentence: `Two searches run side by side: nearest vectors and matching words, ${defaults.candidates} results each. Reciprocal rank fusion (k = ${defaults.rrfK}) merges the lists into ${defaults.candidates} candidates. ${formatInt(run.ms.search)} ms, mostly the trip to Neon.`,
    lesson: "hybrid-retrieval",
    tool: { href: "/lab/retrieval", label: "Retrieval arena" },
  },
  {
    flow: "ask",
    title: "Rerank",
    sub: `${defaults.candidates} → ${defaults.topK}`,
    box: bottom(3),
    sentence: `${rerankModel.label} reads the question with each of the ${defaults.candidates} candidates and keeps the best ${defaults.topK}, in ${formatInt(run.ms.rerank)} ms. These are the ${defaults.topK} it kept, with its scores:`,
    lesson: "reranking",
    tool: { href: "/lab/retrieval", label: "Retrieval arena" },
    show: "sources",
  },
  {
    flow: "ask",
    title: "Prompt",
    sub: `${formatInt(run.inputTokens)} tokens`,
    box: bottom(4),
    sentence: `Rules, the ${defaults.topK} numbered sources and the question become one prompt of ${formatInt(run.inputTokens)} tokens, about 95% of them sources. Building it takes under 1 ms.`,
    lesson: "prompt-construction",
    tool: { href: `${runPage}/prompt`, label: "Prompt inspector" },
  },
  {
    flow: "ask",
    title: "Model",
    sub: "Flash-Lite",
    box: bottom(5),
    sentence: `${chatModels.geminiFlashLite.label} reads the whole prompt. Its first token comes back ${formatInt(run.ms.firstToken)} ms after the request.`,
    lesson: "llm-api-call",
    tool: { href: "/ledger", label: "Token ledger" },
  },
  {
    flow: "ask",
    title: "Answer",
    sub: `${run.outputTokens} tokens`,
    box: bottom(6),
    sentence: `The answer streams back token by token: ${run.outputTokens} tokens in ${formatInt(run.ms.writing)} ms. It cites [1] and [2], and says the sources don't cover the second half of the question.`,
    lesson: "streaming",
    tool: { href: `${runPage}/stream`, label: "Streaming debugger" },
    show: "answer",
  },
];

const LAST = stages.length - 1;
const INDEX_STAGES = stages.filter((s) => s.flow === "index").length;
const STEP_MS = 2600;
const TOKEN_MS = 45;
// Each word with the space after it, so a partial answer keeps its spacing.
const words = run.answer.match(/\S+\s*/g) ?? [];

const tone = (s: Stage): Tone => (s.title === "Vector store" ? 7 : s.flow === "index" ? 1 : 2);

const reducedMotion = "(prefers-reduced-motion: reduce)";
function subscribe(onChange: () => void) {
  const mql = window.matchMedia(reducedMotion);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * One real question followed through the app, stage by stage: Play, Pause,
 * Step and Reset, with Space and the arrow keys. Under prefers-reduced-motion
 * nothing moves on its own: there is no Play, and the answer appears whole.
 */
export function PipelineWalkthrough() {
  const still = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(reducedMotion).matches,
    () => false,
  );
  // -1 is the overview, before the first stage.
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  // How many answer pieces have streamed in; null shows the whole answer.
  const [typed, setTyped] = useState<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    const timer =
      step === LAST
        ? setTimeout(() => {
            if (typed === null || typed >= words.length) setPlaying(false);
            else setTyped(typed + 1);
          }, TOKEN_MS)
        : setTimeout(() => {
            setStep(step + 1);
            setTyped(0);
          }, STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, step, typed]);

  /** Move by `by` stages (fast key repeats each count), or to the overview. */
  function go(by: number | "reset") {
    setPlaying(false);
    setTyped(null);
    setStep((s) => (by === "reset" ? -1 : Math.max(-1, Math.min(LAST, s + by))));
  }

  function toggle() {
    if (still) return;
    if (playing) return setPlaying(false);
    // From the overview or the end, Play starts at the first stage at once.
    if (step < 0 || step === LAST) {
      setStep(0);
      setTyped(null);
    }
    setPlaying(true);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    // Space on a focused button already clicks it.
    if (e.key === " " && (e.target as HTMLElement).closest("button")) return;
    if (e.key === " ") toggle();
    else if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
    else return;
    e.preventDefault();
  }

  const current = step >= 0 ? stages[step] : undefined;
  const lesson = current && lessons.find((l) => l.slug === current.lesson);

  return (
    <section
      role="group"
      aria-label="Pipeline walkthrough: one real question followed through the app"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="not-prose border-border focus-visible:ring-ring my-8 rounded-lg border bg-white outline-none focus-visible:ring-2"
    >
      <div className="hidden p-3 sm:block">
        <Diagram step={step} />
      </div>
      <Progress step={step} />

      <div className="border-border flex flex-wrap items-center gap-2 border-t px-3 py-2">
        {!still && (
          <Button size="sm" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
            {playing ? "Pause" : "Play"}
          </Button>
        )}
        <Button
          size="icon-sm"
          variant="outline"
          onClick={() => go(-1)}
          disabled={step < 0}
          aria-label="Step back"
        >
          <ChevronLeft aria-hidden />
        </Button>
        <Button
          size="icon-sm"
          variant="outline"
          onClick={() => go(1)}
          disabled={step === LAST}
          aria-label="Step forward"
        >
          <ChevronRight aria-hidden />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => go("reset")} disabled={step < 0}>
          <RotateCcw aria-hidden />
          Reset
        </Button>
        <span className="text-muted-foreground ml-auto hidden text-xs sm:inline">
          {still ? "← → step" : "Space plays or pauses, ← → step"}
        </span>
      </div>

      <div
        className="border-border min-h-40 border-t p-4 text-sm leading-relaxed"
        aria-live="polite"
      >
        {current ? (
          <>
            <p className="text-muted-foreground mb-1 text-xs font-medium">
              Step {step + 1} of {stages.length} ·{" "}
              {current.flow === "index" ? "Once per document" : "Every question"}
            </p>
            <p className="mb-2 flex items-center gap-2 font-semibold">
              <span
                className="size-2.5 rounded-full"
                style={{ background: ink(tone(current)) }}
                aria-hidden
              />
              {current.title}
            </p>
            <p>{current.sentence}</p>
            {current.show === "question" && (
              <p className="border-border mt-3 border-l-2 pl-3 italic">“{run.question}”</p>
            )}
            {current.show === "sources" && <Sources />}
            {current.show === "answer" && (
              <p className="bg-muted mt-3 rounded-md p-3 whitespace-pre-line">
                {words.slice(0, typed ?? words.length).join("")}
                {typed !== null && typed < words.length && (
                  <span className="bg-foreground ml-0.5 inline-block h-3.5 w-1.5 animate-pulse align-middle" />
                )}
              </p>
            )}
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {lesson && (
                <a
                  href={`/learn/${lesson.slug}`}
                  className="text-primary font-medium underline underline-offset-4"
                >
                  Lesson {lesson.number}: {lesson.title}
                </a>
              )}
              <a
                href={current.tool.href}
                className="text-primary font-medium underline underline-offset-4"
              >
                Try it: {current.tool.label}
              </a>
            </p>
          </>
        ) : (
          <p>
            Follow one real question through the app:{" "}
            <span className="italic">“{run.question}”</span> Every number is from that run, with
            nothing cached. First, how a document gets in; then what happens to the question.{" "}
            {still ? "Step through with →." : "Press Play, or step through with →."}
          </p>
        )}
      </div>
    </section>
  );
}

function Diagram({ step }: { step: number }) {
  const current = step >= 0 ? stages[step] : undefined;
  const state = (i: number) => (step < 0 || i < step ? "done" : i === step ? "current" : "next");
  // Arrow i leads into stage i; the question row's first arrow goes into stage 5.
  const lit = (i: number) => step < 0 || i <= step;
  const flowArrow = (from: number, to: number) => {
    const a = stages[from].box;
    const b = stages[to].box;
    return (
      <g
        key={to}
        opacity={lit(to) ? 1 : 0.3}
        className="transition-opacity duration-300 motion-reduce:transition-none"
      >
        <Arrow
          points={[
            [a.x + a.w, a.y + a.h / 2],
            [b.x - 2, b.y + b.h / 2],
          ]}
          tone={tone(stages[to])}
        />
      </g>
    );
  };

  return (
    <Svg height={292}>
      <Text x={0} y={14} weight={600} tone={1}>
        Once per document
      </Text>
      <Text x={0} y={ROW2 - 16} weight={600} tone={2}>
        Every question
      </Text>

      {flowArrow(0, 1)}
      {flowArrow(1, 2)}
      {[5, 6, 7, 8, 9, 10].map((i) => flowArrow(i - 1, i))}
      <g
        opacity={lit(3) ? 1 : 0.3}
        className="transition-opacity duration-300 motion-reduce:transition-none"
      >
        <Arrow
          points={[
            [mid(2), ROW1 + H],
            [mid(2), STORE.y - 2],
          ]}
          tone={1}
        />
      </g>
      <g
        opacity={lit(6) ? 1 : 0.3}
        className="transition-opacity duration-300 motion-reduce:transition-none"
      >
        <Arrow
          points={[
            [mid(2), ROW2 - 2],
            [mid(2), STORE.y + STORE.h + 2],
          ]}
          tone={2}
          both
        />
      </g>

      {stages.map((s, i) => {
        const st = state(i);
        const { x, y, w, h } = s.box;
        return (
          <g
            key={i}
            opacity={st === "next" ? 0.4 : 1}
            className="transition-opacity duration-300 motion-reduce:transition-none"
          >
            {st === "current" && (
              <rect
                x={x - 4}
                y={y - 4}
                width={w + 8}
                height={h + 8}
                rx={11}
                fill={wash(tone(s), 30)}
                stroke={ink(tone(s))}
                strokeWidth={2}
              />
            )}
            <Box x={x} y={y} w={w} h={h} tone={tone(s)} title={s.title} sub={s.sub} />
          </g>
        );
      })}

      {/* The question (or the document) as a dot moving from stage to stage. */}
      {current && (
        <g
          style={{
            transform: `translate(${current.box.x + current.box.w / 2}px, ${current.box.y - 4}px)`,
          }}
          className="transition-transform duration-500 ease-out motion-reduce:transition-none"
        >
          <circle r={6} fill={ink(tone(current))} stroke="white" strokeWidth={2} />
        </g>
      )}
    </Svg>
  );
}

/** Phones get a segment per stage instead of the diagram, which would be too small to read. */
function Progress({ step }: { step: number }) {
  const segment = (i: number) => (
    <span
      key={i}
      className="h-1.5 flex-1 rounded-full"
      style={{
        background: i <= step ? ink(tone(stages[i])) : wash(tone(stages[i]), 25),
      }}
    />
  );
  return (
    <div className="space-y-3 px-4 pt-4 pb-3 sm:hidden" aria-hidden>
      <div>
        <p className="mb-1.5 text-xs font-semibold" style={{ color: ink(1) }}>
          Once per document
        </p>
        <div className="flex w-[36%] gap-1">
          {stages.slice(0, INDEX_STAGES).map((_, i) => segment(i))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold" style={{ color: ink(2) }}>
          Every question
        </p>
        <div className="flex gap-1">
          {stages.slice(INDEX_STAGES).map((_, i) => segment(i + INDEX_STAGES))}
        </div>
      </div>
    </div>
  );
}

function Sources() {
  return (
    <ol className="mt-3 space-y-2">
      {run.sources.map((s, i) => (
        <li key={i} className="grid grid-cols-[1.5rem_1fr_3rem] items-start gap-x-2">
          <span className="text-muted-foreground font-mono text-xs leading-5">[{i + 1}]</span>
          <span className="min-w-0">
            <span className="block truncate font-mono text-xs leading-5">{s.title}</span>
            <span className="text-muted-foreground block truncate text-xs">{s.excerpt}</span>
            <span className="bg-muted mt-1 block h-1.5 rounded-full">
              <span
                className="block h-full rounded-full"
                style={{ width: `${s.score * 100}%`, background: ink(4) }}
              />
            </span>
          </span>
          <span className="text-right font-mono text-xs leading-5">{s.score.toFixed(2)}</span>
        </li>
      ))}
    </ol>
  );
}
