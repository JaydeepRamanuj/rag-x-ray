import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { guides } from "./guides";
import { glossary, glossaryById, glossaryGroups } from "./glossary";
import { lessons } from "./learn/lessons";

// Every file that can contain <Term id="…">.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (name === "node_modules" || name.startsWith(".")) return [];
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx|mdx)$/.test(name) ? [full] : [];
  });
}

describe("glossary", () => {
  it("has unique ids, known groups and valid cross-references", () => {
    expect(new Set(glossary.map((g) => g.id)).size).toBe(glossary.length);
    for (const g of glossary) {
      expect(glossaryGroups).toContain(g.group);
      for (const id of g.see ?? []) expect(glossaryById.has(id), `${g.id} → ${id}`).toBe(true);
    }
  });

  it("defines every term used in the app and the lessons", () => {
    const root = path.resolve(__dirname, "..");
    const used = ["app", "components", "content"]
      .flatMap((d) => sourceFiles(path.join(root, d)))
      .flatMap((f) =>
        [...readFileSync(f, "utf8").matchAll(/<Term id="([^"]+)"/g)].map((m) => m[1]),
      );
    expect(used.length).toBeGreaterThan(50);
    expect(used.filter((id) => !glossaryById.has(id))).toEqual([]);
  });
});

describe("guides", () => {
  it("link only to written lessons, and each page has at most one guide", () => {
    for (const g of guides) {
      for (const slug of g.lessons) {
        expect(lessons.find((l) => l.slug === slug)?.written, `${g.title} → ${slug}`).toBe(true);
      }
    }
    for (const p of ["/chat", "/lab/retrieval", "/runs/abc/prompt", "/runs/abc/stream"]) {
      expect(guides.filter((g) => g.match(p))).toHaveLength(1);
    }
    expect(guides.filter((g) => g.match("/learn/tokens"))).toHaveLength(0);
  });
});
