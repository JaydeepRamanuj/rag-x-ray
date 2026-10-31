import { ComingSoon } from "@/components/coming-soon";
import { findNavItem } from "@/lib/nav";

const item = findNavItem("/lab/retrieval");

export default function Page() {
  return <ComingSoon {...item} />;
}
