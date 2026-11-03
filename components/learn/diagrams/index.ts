import { ApiCallDiagram } from "./api-call";
import { ChunkOverlapDiagram } from "./chunk-overlap";
import { CostLeversDiagram } from "./cost-levers";
import { EmbeddingAnglesDiagram } from "./embedding-angles";
import { ExactVsHnswDiagram } from "./exact-vs-hnsw";
import { HitRankDiagram } from "./hit-rank";
import { PipelineTimingDiagram } from "./pipeline-timing";
import { PromptBudgetDiagram } from "./prompt-budget";
import { RerankFunnelDiagram } from "./rerank-funnel";
import { RrfDiagram } from "./rrf";
import { StreamHopsDiagram } from "./stream-hops";
import { TokenPillsDiagram } from "./token-pills";

/** Every lesson diagram, registered by name in mdx-components.tsx. */
export const diagrams = {
  ApiCallDiagram,
  ChunkOverlapDiagram,
  CostLeversDiagram,
  EmbeddingAnglesDiagram,
  ExactVsHnswDiagram,
  HitRankDiagram,
  PipelineTimingDiagram,
  PromptBudgetDiagram,
  RerankFunnelDiagram,
  RrfDiagram,
  StreamHopsDiagram,
  TokenPillsDiagram,
};
