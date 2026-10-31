// Client-safe: the chat UI imports this, so it must not pull in the database.
export const METHODS = ["vector", "keyword", "hybrid"] as const;
export type Method = (typeof METHODS)[number];
