import { ComingSoon } from "@/components/coming-soon";
import { findNavItem } from "@/lib/nav";

const item = findNavItem("/chat");

export default function Page() {
  return <ComingSoon {...item} />;
}
