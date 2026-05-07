import type { UserRole } from "@/contexts/auth-context";

export const NAV_ACCESS: Record<string, UserRole[]> = {
  "/dashboard": ["compliance_officer"],
  "/transactions": ["compliance_officer", "compliance_analyst", "compliance_ops_agent", "rules_manager", "auditor"],
  "/onboarding": ["compliance_officer", "compliance_analyst", "compliance_ops_agent", "auditor"],
  "/cases": ["compliance_officer", "compliance_analyst", "compliance_ops_agent", "auditor"],
  "/review": ["compliance_officer", "compliance_analyst", "compliance_ops_agent", "auditor"],
  "/rules": ["compliance_officer", "compliance_analyst", "rules_manager", "auditor"],
  "/talk-to-data": ["compliance_officer", "compliance_analyst", "rules_manager", "auditor"],
  "/recommendations": ["compliance_officer", "compliance_analyst", "rules_manager", "auditor"],
  "/audit": ["compliance_officer", "auditor"],
  "/integrations": ["engineer"],
  "/health": ["engineer"],
};

export const ROLE_DEFAULT_ROUTE: Record<UserRole, string> = {
  compliance_officer: "/dashboard",
  compliance_analyst: "/review",
  compliance_ops_agent: "/onboarding",
  rules_manager: "/rules",
  engineer: "/health",
  auditor: "/transactions",
};

export function canAccessRoute(role: UserRole, path: string): boolean {
  // Find the longest matching nav prefix
  const match = Object.keys(NAV_ACCESS).find(
    (p) => path === p || path.startsWith(p + "/"),
  );
  if (!match) return true; // unknown routes (e.g. /dashboard, /) — let router handle
  return NAV_ACCESS[match].includes(role);
}
