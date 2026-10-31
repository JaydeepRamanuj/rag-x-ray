-- drizzle-kit doesn't manage extensions, so pgvector is enabled in its own
-- migration that runs before any table uses the vector type.
CREATE EXTENSION IF NOT EXISTS vector;
