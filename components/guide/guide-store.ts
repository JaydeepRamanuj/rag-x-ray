"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the guide panel is open, and which steps of each guide are ticked.
 * A tiny external store rather than context, so the header button and the
 * panel (siblings in the layout) share it without a provider. The server
 * snapshot is "closed", so the first paint matches the server HTML.
 */

type State = { open: boolean; done: Record<string, number[]> };

const STORAGE = { seen: "guide:seen", done: "guide:done", closed: "guide:closed" };

let state: State = { open: false, done: read(STORAGE.done, {}) };
const listeners = new Set<() => void>();
const serverState: State = { open: false, done: {} };

function emit(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useGuideState() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
}

export function setGuideOpen(open: boolean) {
  // Closing on purpose stops every page opening it on first visit.
  if (!open) write(STORAGE.closed, true);
  emit({ ...state, open });
}

/**
 * Open the guide the first time a page is visited, unless the reader has
 * closed the panel before (then they know where the button is).
 */
export function openOnFirstVisit(key: string) {
  const seen = read<string[]>(STORAGE.seen, []);
  if (seen.includes(key)) return;
  write(STORAGE.seen, [...seen, key]);
  if (!read(STORAGE.closed, false) && !state.open) emit({ ...state, open: true });
}

export function toggleStep(key: string, n: number) {
  const current = state.done[key] ?? [];
  const next = current.includes(n) ? current.filter((x) => x !== n) : [...current, n];
  const done = { ...state.done, [key]: next };
  write(STORAGE.done, done);
  emit({ ...state, done });
}

// localStorage can be missing or throw (private windows, blocked storage);
// the guide still works, it just forgets between visits.
function read<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
