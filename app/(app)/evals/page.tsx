import { ComingSoon } from "@/components/coming-soon";
import { findNavItem } from "@/lib/nav";

const item = findNavItem("/evals");

export default function Page() {
  return <ComingSoon {...item} />;
}
