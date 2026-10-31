import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Same precedence as Next.js: .env.local wins over .env.
config({ path: [".env.local", ".env"], quiet: true });

// Migrations run DDL in a transaction, which the PgBouncer pooled endpoint
// doesn't handle well, so they go over the direct connection. Neon's direct
// host is the pooled host without "-pooler", so derive it if it isn't set.
const directUrl =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL?.replace("-pooler.", ".") || "";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: { url: directUrl },
});
