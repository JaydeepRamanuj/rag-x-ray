"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScanSearch } from "lucide-react";
import { Suspense } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { navGroups } from "@/lib/nav";

const allHrefs = navGroups.flatMap((g) => g.items.map((i) => i.href));

/** The most specific nav item for a path, so /learn/glossary lights up Glossary, not Lessons too. */
function activeHref(pathname: string | null) {
  if (!pathname) return null;
  return (
    allHrefs
      .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
      .sort((a, b) => b.length - a.length)[0] ?? null
  );
}

function NavItems({ pathname }: { pathname: string | null }) {
  const active = activeHref(pathname);
  return navGroups.map((group) => (
    <SidebarGroup key={group.label}>
      <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={item.href === active}
                render={<Link href={item.href} />}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ));
}

function ActiveNavItems() {
  return <NavItems pathname={usePathname()} />;
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/chat" />}>
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-md">
                <ScanSearch className="size-4" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="font-semibold">RAG X-Ray</span>
                <span className="text-muted-foreground text-xs">every stage, visible</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* The pathname is only known at request time on dynamic routes like
            /runs/[id], so the prerendered shell shows the links unhighlighted
            and the active state streams in. */}
        <Suspense fallback={<NavItems pathname={null} />}>
          <ActiveNavItems />
        </Suspense>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Health"
              render={<a href="/api/health" target="_blank" rel="noreferrer" />}
            >
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="text-xs">/api/health</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
