import type { ReactNode } from "react";

/**
 * A "How to use this page" guide, shown in the side panel. Every guide has
 * the same sections, in the order a first-time visitor needs them: what the
 * page is, why it exists, what you can change, one experiment to try, how to
 * read the result, the trade-offs, and what tends to confuse people.
 */
export type Guide = {
  /** Which pages show this guide. */
  match: (pathname: string) => boolean;
  title: string;
  /** What the page is for, in two or three plain sentences. */
  summary: ReactNode;
  /** Why the tool exists: the question it answers, and what you'd miss without it. */
  why: ReactNode;
  /** Each control on the page. */
  inputs: Item[];
  /** A first experiment: what to do, then what you should see. */
  steps: { do: ReactNode; see: ReactNode }[];
  /** Each number, colour or panel in the output. */
  reading: Item[];
  /** Strengths and weaknesses of the technique the page shows. */
  pros: ReactNode[];
  cons: ReactNode[];
  /** Things that look like bugs but aren't, and common misreadings. */
  surprises: ReactNode[];
  /** Lesson slugs for the theory. */
  lessons: string[];
  /** The next page in the Start here tour. */
  next?: { href: string; label: string };
};

export type Item = { name: ReactNode; what: ReactNode };
