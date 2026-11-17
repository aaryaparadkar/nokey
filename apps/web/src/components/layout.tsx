import { FingerprintIcon } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "text-sm text-muted-foreground transition-colors hover:text-foreground",
    isActive && "text-foreground",
  );

export function Layout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <FingerprintIcon className="size-5" /> nokey
          </Link>
          <nav className="flex items-center gap-4">
            <NavLink to="/" end className={navClass}>
              New paste
            </NavLink>
            <NavLink to="/me" className={navClass}>
              My pastes
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4 text-xs text-muted-foreground">
          <span>No passwords. No emails. Just passkeys.</span>
          <a href="https://github.com" className="hover:text-foreground">
            Source
          </a>
        </div>
      </footer>
    </div>
  );
}
