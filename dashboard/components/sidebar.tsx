"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Ticket,
  FolderKanban,
  Settings,
  FileText,
  Star,
  Users,
  ClipboardList,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Panel Builder", href: "/dashboard/panels", icon: Ticket },
  { name: "Categories", href: "/dashboard/categories", icon: FolderKanban },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
  { name: "Transcripts", href: "/dashboard/transcripts", icon: FileText },
  { name: "Ratings", href: "/dashboard/ratings", icon: Star },
  { name: "Staff", href: "/dashboard/staff", icon: Users },
  { name: "Audit Logs", href: "/dashboard/logs", icon: ClipboardList },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Ticket className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">Ticket Dashboard</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? (
            <Sun className="mr-2 h-4 w-4" />
          ) : (
            <Moon className="mr-2 h-4 w-4" />
          )}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </Button>
        <Link href="/logout">
          <Button variant="ghost" size="sm" className="w-full justify-start text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </Link>
      </div>
    </div>
  );
}
