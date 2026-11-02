import { Suspense } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { GuideButton, GuidePanel } from "@/components/guide/guide-panel";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      {/* min-w-0 lets the main column shrink below its content width, so wide
          tables and code scroll inside it instead of widening the page. */}
      <SidebarInset className="min-w-0">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-muted-foreground text-sm">RAG X-Ray</span>
          {/* Which guide to show depends on the path, only known at request
              time on dynamic routes, so it streams in like the sidebar's
              active state. */}
          <Suspense>
            <GuideButton />
          </Suspense>
        </header>
        {/* The guide sits beside the page, not over it, on wide screens. */}
        <div className="flex flex-1">
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
          <Suspense>
            <GuidePanel />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
