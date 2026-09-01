import type { ReactNode } from "react";
import type { AccountRole } from "@/lib/auth/roles";

export type NavLeaf = { label: string; href: string };
export type NavLink = { type: "link"; label: string; href: string; icon: ReactNode };
export type NavGroup = { type: "group"; label: string; icon: ReactNode; items: NavLeaf[] };
export type NavEntry = NavLink | NavGroup;

export type PanelUser = {
  id: string;
  email: string | null;
  displayName: string;
  role?: AccountRole;
};

export function isGroupActive(group: NavGroup, pathname: string) {
  return group.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
