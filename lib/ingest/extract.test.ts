import { describe, expect, it } from "vitest";

import { normalizeText, sourceTypeFor } from "./extract";

describe("normalizeText", () => {
  it("keeps paragraph breaks and collapses runs of blank lines", () => {
    expect(normalizeText("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("joins words hyphenated across a line break", () => {
    expect(normalizeText("vector retrie-\nval works")).toBe("vector retrieval works");
  });

  it("normalises line endings and trims spaces around newlines", () => {
    expect(normalizeText("one  \r\n   two\rthree")).toBe("one\ntwo\nthree");
  });
});

describe("sourceTypeFor", () => {
  it("maps extensions", () => {
    expect(sourceTypeFor("Notes.MD")).toBe("md");
    expect(sourceTypeFor("a.pdf")).toBe("pdf");
    expect(sourceTypeFor("a.txt")).toBe("txt");
    expect(sourceTypeFor("a.docx")).toBeNull();
  });
});
