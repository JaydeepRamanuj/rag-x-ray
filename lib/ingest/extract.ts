import { extractText, getDocumentProxy } from "unpdf";

export type SourceType = "pdf" | "md" | "txt";

export type Extracted = {
  sourceType: SourceType;
  text: string;
  pages: number | null;
};

export function sourceTypeFor(filename: string): SourceType | null {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "pdf") return "pdf";
  if (ext === "md" || ext === "markdown" || ext === "mdx") return "md";
  if (ext === "txt" || ext === "text") return "txt";
  return null;
}

/**
 * Cleans text so chunk boundaries land where meaning changes, not where a
 * PDF happened to wrap a line. Paragraph breaks (blank lines) are what the
 * recursive chunker cuts on first, so they must survive; everything else is
 * tidied.
 */
export function normalizeText(text: string): string {
  return (
    text
      .replace(/\r\n?/g, "\n")
      // PDFs hyphenate across line ends: "retrie-\nval" → "retrieval".
      .replace(/(\w)-\n(\w)/g, "$1$2")
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

export async function extract(filename: string, bytes: Uint8Array): Promise<Extracted> {
  const sourceType = sourceTypeFor(filename);
  if (!sourceType) throw new Error("Only .pdf, .md and .txt files are supported.");

  if (sourceType === "pdf") {
    const pdf = await getDocumentProxy(bytes);
    // One string per page, joined with blank lines so a page break is also
    // a paragraph break for the chunker.
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    return { sourceType, text: normalizeText(text.join("\n\n")), pages: totalPages };
  }

  // fatal: true rejects files that aren't valid UTF-8 instead of filling them
  // with replacement characters.
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return { sourceType, text: normalizeText(text), pages: null };
}
