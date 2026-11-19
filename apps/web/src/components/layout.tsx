import { Link, NavLink, Outlet } from "react-router";
import { Fingerprint, Icon } from "@/components/sodium/icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/sodium/utils";

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn("type-label whitespace-nowrap text-text-2 hover:text-text-1", isActive && "text-text-1");

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col bg-page text-text-1">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-256 items-center gap-4 px-4 sm:gap-6">
          <Link to="/" className="type-heading-sm flex items-center gap-2">
            <Icon icon={Fingerprint} size={20} />
            <span className="max-sm:sr-only">nokey</span>
          </Link>
          <nav className="flex items-center gap-3 sm:gap-4">
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
      <main className="mx-auto w-full max-w-256 flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-line">
        <div className="type-caption mx-auto flex h-12 max-w-256 items-center justify-between px-4 text-text-2">
          <span>No passwords. No emails. Just passkeys.</span>
          <a href="https://github.com" className="hover:text-text-1">
            Source
          </a>
        </div>
      </footer>
    </div>
  );
}
