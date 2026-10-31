# RAG X-Ray

A chat-over-your-documents app where every pipeline stage (chunking, embeddings, retrieval, prompt, streaming, tokens, evals) is visible, adjustable and measured. See [the build plan](docs/RAG%20X-Ray%20—%20Build%20Plan.md) for the full spec.

**Status:** Phase 2: upload documents, chunk and embed them into pgvector (with an embedding cache), and get cited answers in chat. Every call is saved to `runs`.

## Setup

Requires Node 20+ and pnpm.

```bash
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm db:migrate              # enables pgvector and creates the tables in Neon
pnpm dev
```

Open http://localhost:3000. `GET /api/health` reports database latency and the pgvector version.

## Scripts

| Script                            | What it does                                   |
| --------------------------------- | ---------------------------------------------- |
| `pnpm dev` / `build` / `start`    | Next.js                                        |
| `pnpm lint` / `typecheck`         | ESLint, and `tsc` after generating route types |
| `pnpm format` / `format:check`    | Prettier                                       |
| `pnpm test`                       | Vitest (pure logic only; API calls are mocked) |
| `pnpm db:generate` / `db:migrate` | Drizzle migrations from `lib/db/schema.ts`     |

## Layout

- `app/(app)/*`: module pages behind the sidebar shell; `app/api/*`: route handlers
- `lib/config.ts`: every model ID, free-tier limit and paid list price
- `lib/db/`: Drizzle schema and the Neon client
- `content/learn/`: Learn page lessons (MDX)
- `drizzle/`: SQL migrations
