import { chatGuide } from "./chat";
import { chunkingGuide } from "./chunking";
import { documentsGuide } from "./documents";
import { embeddingsGuide } from "./embeddings";
import { evalsGuide } from "./evals";
import { ledgerGuide } from "./ledger";
import { promptInspectorGuide } from "./prompt-inspector";
import { retrievalGuide } from "./retrieval";
import { sdkGuide } from "./sdk";
import { streamDebuggerGuide } from "./stream-debugger";
import type { Guide } from "./types";

/** In the order of the Start here tour. */
export const guides: Guide[] = [
  chatGuide,
  documentsGuide,
  chunkingGuide,
  embeddingsGuide,
  retrievalGuide,
  promptInspectorGuide,
  streamDebuggerGuide,
  ledgerGuide,
  evalsGuide,
  sdkGuide,
];

export function guideFor(pathname: string): Guide | undefined {
  return guides.find((g) => g.match(pathname));
}
