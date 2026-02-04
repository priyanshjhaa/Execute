"use client";

import { usePathname } from "next/navigation";
import { Terminal, LayoutDashboard, GitBranch, Activity, Settings, LogOut, Users, Puzzle } from "lucide-react";
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
    <div className="min-h-screen bg-black">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-50 h-screen w-64 border-r border-white/10 bg-black">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-6">
          <Terminal className="h-5 w-5 text-white" />
          <span className="text-lg font-semibold text-white">Execute</span>
        </div>

        {/* Navigation */}
        <nav className="space-y-1 p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-4">
          <Link href="/dashboard/settings">
            <div className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white">
              <Settings className="h-5 w-5" />
              Settings
            </div>
          </Link>

          <div className="mt-2 flex items-center gap-3 rounded-lg px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
              <span className="text-sm font-semibold text-white">
                {user?.name?.charAt(0).toUpperCase() || user?.email.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-white/40 truncate">{user?.email}</p>
            </div>
          </div>

          {/* Sign Out Button - Functional */}
          <Button
            onClick={handleSignOut}
            variant="ghost"
            className="w-full justify-start gap-3 text-white/60 hover:text-white hover:bg-white/5 rounded-lg mt-2"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64">
        {children}
      </main>
    </div>
  );
}
