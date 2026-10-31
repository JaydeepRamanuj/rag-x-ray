import { ComingSoon } from "@/components/coming-soon";

export default function Page() {
  return (
    <ComingSoon
      title="Prompt inspector"
      description="The exact messages sent for this run, with a token bar per part."
      phase={3}
    />
  );
}
