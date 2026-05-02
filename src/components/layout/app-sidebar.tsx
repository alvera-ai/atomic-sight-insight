import { NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  ClipboardList,
  Sparkles,
  ShieldAlert,
  PlugZap,
  HeartPulse,
  MessageSquareCode,
  Layers,
} from "lucide-react";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Role = "compliance" | "engineer";

const compliance = [
  { title: "Transactions 360°", url: "/transactions", icon: Activity },
  { title: "Onboarding queue", url: "/onboarding", icon: ClipboardList },
  { title: "Review queue", url: "/review", icon: ShieldAlert },
  { title: "Talk to data", url: "/talk-to-data", icon: MessageSquareCode },
  { title: "Recommendations", url: "/recommendations", icon: Sparkles },
];

const engineer = [
  { title: "Integrations", url: "/integrations", icon: PlugZap },
  { title: "Health", url: "/health", icon: HeartPulse },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const initialRole: Role = engineer.some((i) => pathname.startsWith(i.url)) ? "engineer" : "compliance";
  const [role, setRole] = useState<Role>(initialRole);

  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Layers className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-sm font-semibold text-sidebar-foreground">Alvera</div>
              <div className="text-[11px] text-muted-foreground">AtomicFi Ops</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="mx-2 mb-2 mt-1 grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
            <button
              onClick={() => setRole("compliance")}
              className={cn(
                "rounded px-2 py-1 text-xs font-medium transition",
                role === "compliance"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Compliance
            </button>
            <button
              onClick={() => setRole("engineer")}
              className={cn(
                "rounded px-2 py-1 text-xs font-medium transition",
                role === "engineer"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Engineer
            </button>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Compliance</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {compliance.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <NavLink to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Engineer</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {engineer.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <NavLink to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {!collapsed && (
          <div className="px-2 pb-2 text-[11px] text-muted-foreground">
            v0.1 · mock data
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
