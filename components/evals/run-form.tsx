"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { allChatModels, chatModels, defaults, getChatModel, limits } from "@/lib/config";
import { estimateMs, remainingWork } from "@/lib/evals/plan";
import {
  CHUNKINGS,
  type Chunking,
  type EvalMode,
  type RunConfig,
  type RunConfigInput,
} from "@/lib/evals/types";
import { METHODS, type Method } from "@/lib/retrieval/methods";

import type { Progress } from "./evals";
import { Field } from "./shared";

const TOP_K = [1, 3, 5, 10];

export function RunForm({
  itemCount,
  password,
  onPassword,
  progress,
  error,
  onStart,
  onStop,
}: {
  itemCount: number;
  password: string;
  onPassword: (v: string) => void;
  progress: Progress | null;
  error: string | null;
  onStart: (config: RunConfigInput) => void;
  onStop: () => void;
}) {
  const [mode, setMode] = useState<EvalMode>("retrieval");
  const [chunking, setChunking] = useState<Chunking>("active");
  const [method, setMethod] = useState<Method>("vector");
  const [rerank, setRerank] = useState(false);
  const [topK, setTopK] = useState<number>(defaults.topK);
  const [embedding, setEmbedding] = useState<"gemini" | "local">("gemini");
  const [chatModel, setChatModel] = useState<string>(defaults.chatModel);
  const [judgeModel, setJudgeModel] = useState<string>(defaults.judgeModel);
  const [label, setLabel] = useState("");

  const config: RunConfig = {
    mode,
    chunking,
    method,
    rerank,
    topK,
    embedding,
    chatModel,
    judgeModel,
    chunkSetIds: [],
    itemIds: Array.from({ length: itemCount }, (_, i) => String(i)),
  };
  const work = remainingWork({ config, results: { items: [], judgeCalls: [] } });
  const minutes = Math.max(1, Math.round(estimateMs(config, work) / 60_000));
  const judge = getChatModel(judgeModel);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onStart({
      mode,
      chunking,
      method,
      rerank,
      topK,
      embedding,
      chatModel,
      judgeModel,
      label: label.trim() || undefined,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Field id="eval-mode" label="Mode">
          <NativeSelect
            id="eval-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as EvalMode)}
          >
            <NativeSelectOption value="retrieval">Retrieval only (no LLM)</NativeSelectOption>
            <NativeSelectOption value="full">Full: answer and judge</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field id="eval-chunking" label="Chunk sets">
          <NativeSelect
            id="eval-chunking"
            value={chunking}
            onChange={(e) => setChunking(e.target.value as Chunking)}
          >
            {CHUNKINGS.map((c) => (
              <NativeSelectOption key={c} value={c}>
                {c === "active" ? "Active (what chat uses)" : `Newest ${c} set`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field id="eval-method" label="Retrieval">
          <NativeSelect
            id="eval-method"
            value={method}
            onChange={(e) => setMethod(e.target.value as Method)}
          >
            {METHODS.map((m) => (
              <NativeSelectOption key={m} value={m}>
                {m}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field id="eval-k" label="Top-k">
          <NativeSelect id="eval-k" value={topK} onChange={(e) => setTopK(Number(e.target.value))}>
            {TOP_K.map((k) => (
              <NativeSelectOption key={k} value={k}>
                {k}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field id="eval-embedding" label="Embedding">
          <NativeSelect
            id="eval-embedding"
            value={embedding}
            disabled={method === "keyword"}
            onChange={(e) => setEmbedding(e.target.value as "gemini" | "local")}
          >
            <NativeSelectOption value="gemini">Gemini (768 dims)</NativeSelectOption>
            <NativeSelectOption value="local">MiniLM, local (384 dims)</NativeSelectOption>
          </NativeSelect>
        </Field>
        <div className="flex items-center gap-2 pb-1.5">
          <Switch id="eval-rerank" checked={rerank} onCheckedChange={setRerank} />
          <label htmlFor="eval-rerank" className="text-sm">
            Rerank
          </label>
        </div>
        {mode === "full" && (
          <Field id="eval-model" label="Answer model">
            <NativeSelect
              id="eval-model"
              value={chatModel}
              onChange={(e) => setChatModel(e.target.value)}
            >
              {allChatModels.map((m) => (
                <NativeSelectOption key={m.id} value={m.id}>
                  {m.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        )}
        {mode === "full" && (
          <Field id="eval-judge" label="Judge model">
            <NativeSelect
              id="eval-judge"
              value={judgeModel}
              onChange={(e) => setJudgeModel(e.target.value)}
            >
              {[chatModels.geminiFlash, chatModels.geminiFlashLite].map((m) => (
                <NativeSelectOption key={m.id} value={m.id}>
                  {m.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Field id="eval-label" label="Label (optional)">
          <Input
            id="eval-label"
            value={label}
            maxLength={80}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. baseline"
            className="w-64"
          />
        </Field>
        <Field id="eval-password" label="App password">
          <Input
            id="eval-password"
            type="password"
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            placeholder="Not needed in local dev"
            className="w-56"
          />
        </Field>
        {progress ? (
          <Button type="button" variant="destructive" onClick={onStop}>
            Stop
          </Button>
        ) : (
          <Button type="submit" disabled={itemCount === 0}>
            Run {itemCount} questions
          </Button>
        )}
      </div>

      <p className="text-muted-foreground text-xs">
        {mode === "full"
          ? `${itemCount} answers, then ${work.judgeBatches.length} judge calls to ${judge.label} (${limits.judgeBatchSize} answers each; its free tier allows ${(judge.free as { rpd?: number }).rpd ?? "?"} a day).`
          : "Hit rate and MRR only: one query embedding per question, no chat model."}
        {rerank && ` Rerank uses ${itemCount} Cohere calls unless cached (1,000 a month).`}
        {` About ${minutes} min, one question at a time to stay under the rate limits.`}
      </p>

      {progress && <ProgressBar progress={progress} />}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </form>
  );
}

function ProgressBar({ progress }: { progress: Progress }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!progress.waitUntil) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [progress.waitUntil]);
  const waitLeft = progress.waitUntil ? Math.max(0, progress.waitUntil - now) : 0;

  return (
    <div className="flex flex-col gap-1.5" role="status">
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full transition-[width]"
          style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }}
        />
      </div>
      <p className="text-muted-foreground text-xs tabular-nums">
        {progress.label} · {progress.done}/{progress.total} steps
        {waitLeft > 0 && ` · waiting ${Math.ceil(waitLeft / 1000)} s for the rate limit`}
      </p>
    </div>
  );
}
