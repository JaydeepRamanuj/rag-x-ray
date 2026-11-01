import {
  BookA,
  BookOpen,
  Coins,
  FileText,
  GitCompare,
  FlaskConical,
  MessageSquare,
  Orbit,
  Scissors,
  Search,
  Signpost,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  title: string;
  icon: LucideIcon;
  description: string;
};

// Run-scoped pages (/runs/[id]/prompt, /runs/[id]/stream) are reached from a
// chat answer's Inspect button, so they are not top-level nav items.
export const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "App",
    items: [
      {
        href: "/chat",
        title: "Chat",
        icon: MessageSquare,
        description: "Chat over your documents. Every answer can be inspected.",
      },
      {
        href: "/documents",
        title: "Documents",
        icon: FileText,
        description: "Upload, chunk and embed the files chat answers from.",
      },
    ],
  },
  {
    label: "Labs",
    items: [
      {
        href: "/lab/chunking",
        title: "Chunking lab",
        icon: Scissors,
        description: "One document split four ways, side by side.",
      },
      {
        href: "/lab/embeddings",
        title: "Embedding explorer",
        icon: Orbit,
        description: "Every chunk as a dot in 2D, plus a similarity playground.",
      },
      {
        href: "/lab/retrieval",
        title: "Retrieval arena",
        icon: Search,
        description: "Vector, keyword, hybrid and reranked results in four columns.",
      },
      {
        href: "/lab/sdk",
        title: "Library comparison",
        icon: GitCompare,
        description: "The same chat hand-rolled and on the Vercel AI SDK, side by side.",
      },
    ],
  },
  {
    label: "Measure",
    items: [
      {
        href: "/ledger",
        title: "Token ledger",
        icon: Coins,
        description: "Tokens, latency and paid-tier cost for every run.",
      },
      {
        href: "/evals",
        title: "Evals",
        icon: FlaskConical,
        description: "Hit rate, MRR, faithfulness and relevance across runs.",
      },
    ],
  },
  {
    label: "Learn",
    items: [
      {
        href: "/learn/start-here",
        title: "Start here",
        icon: Signpost,
        description: "RAG in plain words, and a guided tour of every page.",
      },
      {
        href: "/learn",
        title: "Lessons",
        icon: BookOpen,
        description: "One lesson per concept, linked back into the app.",
      },
      {
        href: "/learn/glossary",
        title: "Glossary",
        icon: BookA,
        description: "Every term in plain words.",
      },
    ],
  },
];
