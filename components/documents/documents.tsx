"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defaults, limits } from "@/lib/config";
import { loadPassword, savePassword } from "@/lib/client/password";
import { formatInt, formatMs } from "@/lib/format";
import type { IngestEvent } from "@/lib/ingest/events";
import { readSse } from "@/lib/sse/parser";
import { Term } from "@/components/term";

type Doc = {
  id: string;
  title: string;
  sourceType: string;
  tokenCount: number;
  pageCount: number | null;
  chunkCount: number;
  createdAt: string | null;
};

type Job = {
  key: number;
  name: string;
  status: "running" | "done" | "error";
  events: IngestEvent[];
};

export function Documents() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [totalTokens, setTotalTokens] = useState(0);
  const [password, setPassword] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const jobKey = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/documents", { cache: "no-store" });
      const json = await res.json();
      setDocs(json.documents);
      setTotalTokens(json.totalTokens);
      setListError(null);
    } catch (err) {
      setListError(String(err));
    }
  }, []);

  useEffect(() => {
    // Storage only exists in the browser, so the saved password is restored
    // after mount rather than in the initial state (which also renders on the server).
    setPassword(loadPassword());
    void refresh();
  }, [refresh]);

  const busy = jobs.some((j) => j.status === "running");

  function patchJob(key: number, fn: (j: Job) => Job) {
    setJobs((prev) => prev.map((j) => (j.key === key ? fn(j) : j)));
  }

  async function upload(files: FileList) {
    savePassword(password);
    // One at a time: each upload already uses most of a minute's embedding
    // budget, so running them in parallel would only trade progress for 429s.
    for (const file of Array.from(files)) {
      const key = jobKey.current++;
      setJobs((prev) => [{ key, name: file.name, status: "running", events: [] }, ...prev]);
      try {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/ingest", {
          method: "POST",
          headers: { "x-app-password": password },
          body,
        });
        if (!res.ok || !res.body) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? `Upload failed with ${res.status}`);
        }
        for await (const sse of readSse(res.body)) {
          const event = { event: sse.event, data: JSON.parse(sse.data) } as IngestEvent;
          patchJob(key, (j) => ({
            ...j,
            events: [...j.events, event],
            status: event.event === "done" ? "done" : event.event === "error" ? "error" : j.status,
          }));
        }
      } catch (err) {
        patchJob(key, (j) => ({
          ...j,
          status: "error",
          events: [
            ...j.events,
            {
              event: "error",
              data: { atMs: 0, message: err instanceof Error ? err.message : String(err) },
            },
          ],
        }));
      }
    }
    await refresh();
  }

  async function remove(doc: Doc) {
    if (!confirm(`Delete "${doc.title}" and all its chunks?`)) return;
    savePassword(password);
    const res = await fetch(`/api/documents/${doc.id}`, {
      method: "DELETE",
      headers: { "x-app-password": password },
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? `Delete failed with ${res.status}`);
    }
    await refresh();
  }

  const usedPct = Math.min(100, (totalTokens / limits.maxTotalTokens) * 100);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Documents</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Upload text, Markdown or PDF. Each file is extracted, split into ~{defaults.chunkSize}
          -token <Term id="chunk">chunks</Term> with {defaults.chunkOverlap} tokens of{" "}
          <Term id="overlap" />, <Term id="embedding">embedded</Term> with Gemini, and stored in{" "}
          <Term id="pgvector" />. Embeddings are <Term id="cache">cached</Term> by text hash, so
          re-uploading costs nothing.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Upload password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="APP_PASSWORD"
              className="w-56"
              autoComplete="current-password"
            />
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.md,.markdown,.txt"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void upload(e.target.files);
              e.target.value = "";
            }}
          />
          <Button onClick={() => fileInput.current?.click()} disabled={busy}>
            <Upload /> {busy ? "Uploading…" : "Choose files"}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Up to {limits.maxPagesPerUpload} PDF pages or {limits.maxUploadBytes / 1024 / 1024} MB per
          file. Use non-confidential material: Gemini&apos;s free tier may use inputs to improve
          Google&apos;s models.
        </p>
        <div className="flex flex-col gap-1">
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>Library size</span>
            <span className="font-mono">
              {formatInt(totalTokens)} / {formatInt(limits.maxTotalTokens)} tokens
            </span>
          </div>
          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
            <div className="bg-primary h-full" style={{ width: `${usedPct}%` }} />
          </div>
        </div>
      </section>

      {jobs.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Uploads</h2>
          {jobs.map((job) => (
            <JobCard key={job.key} job={job} />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Library</h2>
        {listError && <p className="text-destructive text-sm">{listError}</p>}
        {docs === null ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="text-muted-foreground text-sm">No documents yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
                <tr>
                  <th className="px-3 py-2 font-normal">Title</th>
                  <th className="px-3 py-2 font-normal">Type</th>
                  <th className="px-3 py-2 text-right font-normal">Pages</th>
                  <th className="px-3 py-2 text-right font-normal">Tokens</th>
                  <th className="px-3 py-2 text-right font-normal">Chunks</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id} className="border-t">
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <FileText className="text-muted-foreground size-4 shrink-0" />
                        {doc.title}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{doc.sourceType}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{doc.pageCount ?? "–"}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatInt(doc.tokenCount)}</td>
                    <td className="px-3 py-2 text-right font-mono">{doc.chunkCount}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${doc.title}`}
                        onClick={() => void remove(doc)}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  const last = <K extends IngestEvent["event"]>(name: K) =>
    job.events.findLast((e) => e.event === name) as Extract<IngestEvent, { event: K }> | undefined;

  const extracted = last("extracted");
  const chunked = last("chunked");
  const embedding = last("embedding");
  const done = last("done");
  const error = last("error");
  const replacing = last("replacing");

  const embeddedPct = embedding
    ? ((embedding.data.cached + embedding.data.embedded) / Math.max(1, embedding.data.total)) * 100
    : 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{job.name}</span>
        <Badge
          variant={
            job.status === "error" ? "destructive" : job.status === "done" ? "secondary" : "outline"
          }
        >
          {job.status}
        </Badge>
      </div>
      <ol className="text-muted-foreground flex flex-col gap-0.5 font-mono text-xs">
        {extracted && (
          <li>
            {formatMs(extracted.data.atMs)} · extracted {formatInt(extracted.data.chars)} chars
            {extracted.data.pages != null && ` from ${extracted.data.pages} pages`} ≈{" "}
            {formatInt(extracted.data.tokens)} tokens
          </li>
        )}
        {chunked && (
          <li>
            {formatMs(chunked.data.atMs)} · {chunked.data.chunks} chunks, avg{" "}
            {chunked.data.avgTokens} tokens (min {chunked.data.minTokens}, max{" "}
            {chunked.data.maxTokens})
          </li>
        )}
        {embedding && (
          <li>
            {formatMs(embedding.data.atMs)} · embeddings: {embedding.data.cached} from cache,{" "}
            {embedding.data.embedded} from Gemini, batch {embedding.data.batch}/
            {embedding.data.batches}
            {embedding.data.waitMs != null &&
              ` (waiting ${formatMs(embedding.data.waitMs)} for the per-minute token budget)`}
          </li>
        )}
        {replacing && (
          <li>{formatMs(replacing.data.atMs)} · replaced the earlier copy of this file</li>
        )}
        {done && (
          <li className="text-foreground">
            {formatMs(done.data.atMs)} · stored {done.data.chunks} chunks · {done.data.cacheHits}{" "}
            cache hits · {formatInt(done.data.embeddedTokens)} tokens embedded
          </li>
        )}
        {error && <li className="text-destructive">{error.data.message}</li>}
      </ol>
      {job.status === "running" && embedding && (
        <div className="bg-muted h-1 overflow-hidden rounded-full">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${embeddedPct}%` }}
          />
        </div>
      )}
    </div>
  );
}
