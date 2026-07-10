"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Car,
  Inbox,
  MessageSquare,
  UploadCloud,
  Users,
  Settings,
  HelpCircle,
  FileEdit,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Permission } from "@/lib/permissions";

const NAV_ITEMS: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  permission: Permission | null;
}[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, permission: null },
  { href: "/admin/vehicles", label: "Οχήματα", icon: Car, permission: "VEHICLE_READ" },
  { href: "/admin/leads", label: "Leads", icon: Inbox, permission: "LEAD_READ" },
  { href: "/admin/contact-messages", label: "Μηνύματα Επικοινωνίας", icon: MessageSquare, permission: "CONTACT_MESSAGE_READ" },
  { href: "/admin/imports", label: "CarStock / Εισαγωγές / Logs", icon: UploadCloud, permission: "IMPORT_LOG_READ" },
  { href: "/admin/users", label: "Χρήστες", icon: Users, permission: "USER_READ" },
  { href: "/admin/content", label: "Περιεχόμενο", icon: FileEdit, permission: "CONTENT_READ" },
  { href: "/admin/faq", label: "FAQ", icon: HelpCircle, permission: "FAQ_MANAGE" },
  { href: "/admin/settings", label: "Ρυθμίσεις", icon: Settings, permission: "SETTINGS_READ" },
];

interface AdminSidebarProps {
  permissions: Permission[];
}

export function AdminSidebar({ permissions }: AdminSidebarProps) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter(
    (item) => item.permission === null || permissions.includes(item.permission),
  );

  return (
    <nav className="flex h-full w-60 flex-col border-r border-border bg-white py-4">
      <div className="px-5 pb-4">
        <span className="text-lg font-semibold text-primary">Kinsen Admin</span>
      </div>
      <ul className="flex flex-1 flex-col gap-1 px-3">
        {visibleItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "bg-primary text-white" : "text-ink hover:bg-surface",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
