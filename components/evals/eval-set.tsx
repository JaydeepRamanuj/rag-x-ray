"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { EvalItem } from "@/lib/evals/types";

import { Field } from "./shared";

type Api = <T>(url: string, init?: { method?: string; body?: unknown }) => Promise<T>;
type Draft = Pick<EvalItem, "question" | "expectedAnswer" | "sourceText">;

const EMPTY: Draft = { question: "", expectedAnswer: "", sourceText: "" };

/**
 * The questions every run asks. Editing an item changes future runs only:
 * past runs keep the question text they were asked with.
 */
export function EvalSet({
  items,
  api,
  onChanged,
  onPasswordUsed,
}: {
  items: EvalItem[];
  api: Api;
  onChanged: () => void;
  onPasswordUsed: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(fn: () => Promise<unknown>) {
    onPasswordUsed();
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Eval set ({items.length})</h2>
        <div className="flex gap-2">
          {items.length === 0 && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                act(() => api("/api/evals/items", { method: "POST", body: { import: "draft" } }))
              }
            >
              Import the drafted set
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setAdding((a) => !a)}>
            {adding ? "Cancel" : "Add a question"}
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        The source passage is text copied from a document, not a chunk id, so it still matches after
        re-chunking. A retrieved chunk is a hit when it contains most of it.
      </p>
      {error && <p className="text-destructive text-sm">{error}</p>}

      {adding && (
        <ItemForm
          initial={EMPTY}
          busy={busy}
          submitLabel="Add"
          onSubmit={async (draft) => {
            const ok = await act(() =>
              api("/api/evals/items", { method: "POST", body: { items: [draft] } }),
            );
            if (ok) setAdding(false);
          }}
        />
      )}

      <ol className="flex flex-col divide-y rounded-lg border">
        {items.map((item, n) => (
          <li key={item.id} className="p-2.5 text-sm">
            {editing === item.id ? (
              <ItemForm
                initial={item}
                busy={busy}
                submitLabel="Save"
                onCancel={() => setEditing(null)}
                onDelete={async () => {
                  const ok = await act(() =>
                    api(`/api/evals/items/${item.id}`, { method: "DELETE" }),
                  );
                  if (ok) setEditing(null);
                }}
                onSubmit={async (draft) => {
                  const ok = await act(() =>
                    api(`/api/evals/items/${item.id}`, { method: "PATCH", body: draft }),
                  );
                  if (ok) setEditing(null);
                }}
              />
            ) : (
              <button
                type="button"
                className="flex w-full gap-3 text-left"
                onClick={() => setEditing(item.id)}
              >
                <span className="text-muted-foreground w-6 shrink-0 text-right tabular-nums">
                  {n + 1}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span>{item.question}</span>
                  <span className="text-muted-foreground line-clamp-1 text-xs">
                    {item.expectedAnswer}
                  </span>
                </span>
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function ItemForm({
  initial,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial: Draft;
  busy: boolean;
  submitLabel: string;
  onSubmit: (draft: Draft) => void;
  onCancel?: () => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>({
    question: initial.question,
    expectedAnswer: initial.expectedAnswer,
    sourceText: initial.sourceText,
  });
  const set =
    (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((d) => ({ ...d, [key]: e.target.value }));

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft);
      }}
    >
      <Field id="item-question" label="Question">
        <Input id="item-question" value={draft.question} onChange={set("question")} required />
      </Field>
      <Field id="item-answer" label="Expected answer">
        <Textarea
          id="item-answer"
          value={draft.expectedAnswer}
          onChange={set("expectedAnswer")}
          rows={3}
          required
        />
      </Field>
      <Field id="item-source" label="Source passage (copied from the document)">
        <Textarea
          id="item-source"
          value={draft.sourceText}
          onChange={set("sourceText")}
          rows={3}
          required
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {onDelete && (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={busy}
            className="ml-auto"
            onClick={onDelete}
          >
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
