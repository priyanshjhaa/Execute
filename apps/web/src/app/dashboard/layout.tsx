"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Terminal,
  LayoutDashboard,
  GitBranch,
  Activity,
  Settings,
  LogOut,
  Users,
  Puzzle,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import Link from "next/link";

const navItems = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Workflows",
    href: "/dashboard/workflows",
    icon: GitBranch,
  },
  {
    name: "Executions",
    href: "/dashboard/executions",
    icon: Activity,
  },
  {
    name: "Contacts",
    href: "/dashboard/contacts",
    icon: Users,
  },
  {
    name: "Integrations",
    href: "/dashboard/integrations",
    icon: Puzzle,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, signOut, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black lg:flex">
      <div className="sticky top-0 z-40 border-b border-white/10 bg-black/95 backdrop-blur lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-white" />
            <span className="text-lg font-semibold text-white">Execute</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/5"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen border-r border-white/10 bg-black transition-[transform,width] duration-300 lg:sticky lg:top-0 lg:z-30",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          sidebarCollapsed ? "lg:w-20" : "lg:w-64",
          "w-64",
          "lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex h-16 items-center border-b border-white/10",
            sidebarCollapsed ? "justify-center px-3" : "justify-between px-6"
          )}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <Terminal className="h-5 w-5 flex-shrink-0 text-white" />
            {!sidebarCollapsed && <span className="text-lg font-semibold text-white">Execute</span>}
          </div>
          {sidebarCollapsed ? (
            <Button
              variant="ghost"
              size="icon"
              className="hidden text-white/60 hover:bg-white/5 hover:text-white lg:inline-flex"
              onClick={() => setSidebarCollapsed(false)}
            >
              <Menu className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="hidden text-white/60 hover:bg-white/5 hover:text-white lg:inline-flex"
              onClick={() => setSidebarCollapsed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Navigation */}
        <nav className="space-y-1 p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                <div
                  className={cn(
                    "flex items-center rounded-lg py-3 text-sm font-medium transition-colors",
                    sidebarCollapsed ? "justify-center px-2" : "gap-3 px-4",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  )}
                  title={sidebarCollapsed ? item.name : undefined}
                >
                  <item.icon className="h-5 w-5" />
                  {!sidebarCollapsed && item.name}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-4">
          <Link href="/dashboard/settings" onClick={() => setMobileMenuOpen(false)}>
            <div
              className={cn(
                "flex items-center rounded-lg py-3 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white",
                sidebarCollapsed ? "justify-center px-2" : "gap-3 px-4"
              )}
              title={sidebarCollapsed ? "Settings" : undefined}
            >
              <Settings className="h-5 w-5" />
              {!sidebarCollapsed && "Settings"}
            </div>
          </Link>

          <div
            className={cn(
              "mt-2 flex rounded-lg py-3",
              sidebarCollapsed ? "justify-center px-2" : "items-center gap-3 px-4"
            )}
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
              <span className="text-sm font-semibold text-white">
                {user?.name?.charAt(0).toUpperCase() || user?.email.charAt(0).toUpperCase()}
              </span>
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {user?.name || 'User'}
                </p>
                <p className="truncate text-xs text-white/40">{user?.email}</p>
              </div>
            )}
          </div>

          <Button
            onClick={handleSignOut}
            variant="ghost"
            className={cn(
              "mt-2 w-full rounded-lg text-white/60 hover:bg-white/5 hover:text-white",
              sidebarCollapsed ? "justify-center px-2" : "justify-start gap-3"
            )}
            title={sidebarCollapsed ? "Sign Out" : undefined}
          >
            <LogOut className="h-5 w-5" />
            {!sidebarCollapsed && "Sign Out"}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          "min-w-0 flex-1 transition-[padding] duration-300"
        )}
      >
        <div className="hidden h-16 items-center border-b border-white/10 bg-black/95 px-6 backdrop-blur lg:flex">
          <Button
            variant="ghost"
            size="icon"
            className="text-white/60 hover:bg-white/5 hover:text-white"
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        {children}
      </main>
    </div>
  );
}
