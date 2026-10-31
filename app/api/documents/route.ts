import { connection } from "next/server";

import { limits } from "@/lib/config";
import { listDocuments } from "@/lib/db/documents";

export async function GET() {
  await connection();
  const documents = await listDocuments();
  const totalTokens = documents.reduce((s, d) => s + d.tokenCount, 0);
  return Response.json(
    { documents, totalTokens, maxTotalTokens: limits.maxTotalTokens },
    { headers: { "cache-control": "no-store" } },
  );
}
