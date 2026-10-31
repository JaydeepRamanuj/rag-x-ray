"use client";

// Kept in sessionStorage so it survives navigation but not closing the tab.
// Storage can throw (private mode, blocked cookies), so every access is guarded.
const KEY = "rag-xray:app-password";

export function loadPassword(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function savePassword(value: string) {
  try {
    sessionStorage.setItem(KEY, value);
  } catch {
    // fine: the field just won't be pre-filled next time
  }
}
