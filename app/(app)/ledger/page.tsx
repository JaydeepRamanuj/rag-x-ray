import { ComingSoon } from "@/components/coming-soon";
import { findNavItem } from "@/lib/nav";

const item = findNavItem("/ledger");

export default function Page() {
  return <ComingSoon {...item} />;
}
