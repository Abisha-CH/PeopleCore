import { useLocation, Link } from "react-router-dom";
import { ChevronDown, Menu } from "lucide-react";

import { useAuth } from "@/providers/auth-provider";
import { PAGE_TITLES } from "@/config/nav";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials } from "@/lib/format";
import { CommandPalette } from "./command-palette";

/*
 * Header — page breadcrumb on the left; command palette + user menu on the
 * right. Height 64px with a subtle backdrop blur so content scrolling under
 * it stays legible.
 */

interface HeaderProps {
  onMenuToggle: () => void;
  showMenuButton: boolean;
}

function pageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return "Dashboard";
  return parts[parts.length - 1]
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function UserMenu() {
  const { role, displayName, email, signOut } = useAuth();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 gap-2 rounded-full pl-1 pr-2 hover:bg-muted"
          aria-label="Account menu"
        >
          <Avatar className="h-8 w-8 ring-2 ring-brand-100 ring-offset-1">
            <AvatarFallback>{getInitials(displayName ?? email)}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium text-foreground sm:inline">
            {displayName ?? email}
          </span>
          <ChevronDown
            className="hidden h-4 w-4 text-muted-foreground sm:block"
            aria-hidden="true"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-medium text-foreground">
            {displayName ?? email}
          </p>
          <p className="truncate text-xs font-normal text-muted-foreground">
            {email}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/my-profile">My profile</Link>
        </DropdownMenuItem>
        {role === "employee" || role === "manager" ? (
          <DropdownMenuItem asChild>
            <Link to="/my-payslips">My payslips</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()} variant="destructive">
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header({ onMenuToggle, showMenuButton }: HeaderProps) {
  const location = useLocation();
  const { role } = useAuth();
  const title = pageTitle(location.pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-border/70 bg-background/85 backdrop-blur-sm">
      <div className="flex flex-1 items-center gap-3 px-4 sm:px-6">
        {showMenuButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuToggle}
            aria-label="Open navigation menu"
            aria-expanded="false"
            id="mobile-menu-button"
            className="h-11 w-11 lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>
        )}

        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
          <Link
            to="/dashboard"
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            Dashboard
          </Link>
          {location.pathname !== "/dashboard" && (
            <>
              <span className="text-muted-foreground" aria-hidden="true">
                /
              </span>
              <span className="truncate font-medium text-foreground">{title}</span>
            </>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-2 pr-4 sm:pr-6">
        {role && <CommandPalette />}
        <UserMenu />
      </div>
    </header>
  );
}
