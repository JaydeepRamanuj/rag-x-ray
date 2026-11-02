import { timingSafeEqual } from "node:crypto";

import { sha256 } from "@/lib/cache";

/**
 * A single shared password for routes that write data or spend quota.
 * No users, no sessions: this is a learning app, not a product.
 * With APP_PASSWORD unset, local dev is open and production is locked.
 */
export function checkPassword(request: Request): { ok: true } | { ok: false; response: Response } {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    if (process.env.NODE_ENV !== "production") return { ok: true };
    return deny(503, "APP_PASSWORD is not set on the server, so uploads are disabled.");
  }
  const given = request.headers.get("x-app-password") ?? "";
  // Comparing hashes keeps lengths equal, which timingSafeEqual requires,
  // and the constant-time compare doesn't leak how many characters matched.
  const match = timingSafeEqual(Buffer.from(sha256(given)), Buffer.from(sha256(expected)));
  return match ? { ok: true } : deny(401, "Wrong password.");
}

function deny(status: number, message: string) {
  return { ok: false as const, response: Response.json({ error: message }, { status }) };
}
