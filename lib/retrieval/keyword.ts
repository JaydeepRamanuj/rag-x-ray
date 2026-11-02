import { getSql } from "@/lib/db/client";

import { scopeIds, toRetrieved, type RetrievedChunk, type SearchOptions } from "./vector";

/**
 * Postgres full-text search, the keyword half of hybrid retrieval.
 *
 * `plainto_tsquery` stems the question and drops stop words ("What is the
 * RRF constant?" → 'rrf' & 'constant'), but joins the words with AND, and
 * a natural question almost never has every word in one chunk: on this
 * app's documents it matched nothing for three questions out of three. So
 * the ANDs become ORs, which is how BM25-style engines treat a query too.
 *
 * `ts_rank_cd` scores by how often and how close together the query words
 * appear ("cover density"). Unlike BM25 it has no IDF: a rare word like
 * "429" counts no more than a common one like "error". `@@` is the match
 * operator the GIN index on `tsv` serves.
 */
export async function keywordSearch(
  query: string,
  topK: number,
  options: SearchOptions = {},
): Promise<RetrievedChunk[]> {
  const sql = getSql();
  const ids = scopeIds(options);
  const rows = await sql`
    WITH q AS (
      SELECT replace(plainto_tsquery('english', ${query})::text, ' & ', ' | ')::tsquery AS query
    )
    SELECT c.id AS chunk_id, c.document_id, d.title, c.ordinal, c.content, c.token_count,
           ts_rank_cd(c.tsv, q.query) AS score
    FROM chunks c
    JOIN chunk_sets cs ON cs.id = c.chunk_set_id
    JOIN documents d ON d.id = c.document_id
    CROSS JOIN q
    WHERE c.tsv @@ q.query
      AND (CASE WHEN ${ids}::uuid[] IS NULL THEN cs.is_active ELSE cs.id = ANY(${ids}::uuid[]) END)
    ORDER BY score DESC, c.ordinal
    LIMIT ${topK}
  `;
  return rows.map(toRetrieved);
}

/** The tsquery Postgres builds from a question, for showing in the arena. */
export async function explainQuery(query: string): Promise<string> {
  const sql = getSql();
  const [row] = await sql`
    SELECT replace(plainto_tsquery('english', ${query})::text, ' & ', ' | ') AS tsquery
  `;
  return row?.tsquery ?? "";
}
