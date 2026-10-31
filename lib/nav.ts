import {
  BookOpen,
  Coins,
  FileText,
  FlaskConical,
  MessageSquare,
  Orbit,
  Scissors,
  Search,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  title: string;
  icon: LucideIcon;
  /** The build phase that brings this page to life; placeholders show it. */
  phase: number;
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
        phase: 1,
        description: "Chat over your documents. Every answer can be inspected.",
      },
      {
        href: "/documents",
        title: "Documents",
        icon: FileText,
        phase: 2,
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
        phase: 4,
        description: "One document split four ways, side by side.",
      },
      {
        href: "/lab/embeddings",
        title: "Embedding explorer",
        icon: Orbit,
        phase: 6,
        description: "Every chunk as a dot in 2D, plus a similarity playground.",
      },
      {
        href: "/lab/retrieval",
        title: "Retrieval arena",
        icon: Search,
        phase: 4,
        description: "Vector, keyword, hybrid and reranked results in four columns.",
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
        phase: 3,
        description: "Tokens, latency and paid-tier cost for every run.",
      },
      {
        href: "/evals",
        title: "Evals",
        icon: FlaskConical,
        phase: 5,
        description: "Hit rate, MRR, faithfulness and relevance across runs.",
      },
    ],
  },
  {
    label: "Learn",
    items: [
      {
        href: "/learn",
        title: "Lessons",
        icon: BookOpen,
        phase: 0,
        description: "One lesson per concept, linked back into the app.",
      },
    ],
  },
];

export function findNavItem(href: string): NavItem {
  const item = navGroups.flatMap((g) => g.items).find((i) => i.href === href);
  if (!item) throw new Error(`No nav item for ${href}`);
  return item;
}
