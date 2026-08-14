import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { NAV_BY_ROLE, type NavSection } from "@/config/nav";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/format";

const COLLAPSE_KEY = "peoplecore.sidebar.collapsed";

/* -------------------------------------------------------------------------- */
/* Brand                                                                       */
/* -------------------------------------------------------------------------- */

function BrandMark({ compact }: { compact: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-teal-500 text-sm font-bold text-white shadow-sm"
        aria-hidden="true"
      >
        P
      </div>
      {!compact && (
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          PeopleCore
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Nav link                                                                    */
/* -------------------------------------------------------------------------- */

interface NavLinkButtonProps {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  rail: boolean;
  mobile: boolean;
  onNavigate?: () => void;
}

function NavLinkButton({
  href,
  label,
  icon: Icon,
  rail,
  mobile,
  onNavigate,
}: NavLinkButtonProps) {
  const classes = ({ isActive }: { isActive: boolean }) =>
    cn(
      "group relative flex items-center gap-2.5 rounded-lg text-sm transition-colors duration-instant",
      mobile ? "h-11" : "h-9",
      rail ? "justify-center" : "px-3",
      isActive
        ? "bg-muted font-medium text-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  const link = (
    <NavLink
      to={href}
      onClick={mobile ? onNavigate : undefined}
      className={classes}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-600",
                rail && "h-6",
              )}
            />
          )}
          <Icon
            className={cn(
              "shrink-0",
              rail ? "h-5 w-5" : "h-[18px] w-[18px]",
            )}
            aria-hidden="true"
          />
          {!rail && <span className="truncate">{label}</span>}
        </>
      )}
    </NavLink>
  );

  if (rail) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }
  return link;
}

/* -------------------------------------------------------------------------- */
/* Sidebar content (shared by desktop aside + mobile drawer)                   */
/* -------------------------------------------------------------------------- */

interface SidebarContentProps {
  rail: boolean;
  mobile: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
  /** Whether the collapse toggle is shown (desktop, not rail-locked). */
  canCollapse?: boolean;
}

function SidebarContent({
  rail,
  mobile,
  onNavigate,
  onToggleCollapse,
  canCollapse,
}: SidebarContentProps) {
  const { role, displayName, email, signOut } = useAuth();
  const sections: NavSection[] = role ? NAV_BY_ROLE[role] : [];

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-border/60",
          rail ? "justify-center px-0" : "px-5",
        )}
      >
        <BrandMark compact={rail} />
      </div>

      {/* Navigation */}
      <nav
        aria-label="Main navigation"
        className={cn(
          "flex-1 overflow-y-auto px-3 py-5",
          rail ? "space-y-4" : "space-y-6",
        )}
      >
        {sections.map((section, index) => (
          <div key={section.title}>
            {!rail ? (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
            ) : index > 0 ? (
              <div
                className="mx-auto mb-2 h-px w-5 bg-border"
                aria-hidden="true"
              />
            ) : null}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLinkButton
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  rail={rail}
                  mobile={mobile}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle (desktop only) */}
      {canCollapse && onToggleCollapse && (
        <div className="border-t border-border/60 px-3 py-2">
          <Button
            variant="ghost"
            onClick={onToggleCollapse}
            aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "h-9 w-full justify-start gap-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
              rail && "justify-center",
            )}
          >
            {rail ? (
              <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden="true" />
            )}
            {!rail && <span>Collapse</span>}
          </Button>
        </div>
      )}

      {/* Footer / user */}
      <div className="border-t border-border/60 p-3">
        <div
          className={cn(
            "flex items-center gap-2.5",
            rail && "flex-col justify-center gap-1.5",
          )}
        >
          <Avatar className="h-9 w-9">
            <AvatarFallback>{getInitials(displayName ?? email)}</AvatarFallback>
          </Avatar>
          {!rail && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {displayName ?? email}
              </p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void signOut()}
            aria-label="Sign out"
            title="Sign out"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <LogOut
              className={rail ? "h-5 w-5" : "h-[18px] w-[18px]"}
              aria-hidden="true"
            />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sidebar                                                                     */
/* -------------------------------------------------------------------------- */

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const isRailZone = useMediaQuery("(min-width: 1024px) and (max-width: 1279px)");
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const [userCollapsed, setUserCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  // lg–xl zone forces the rail; above xl respect the user's collapse choice.
  const collapsed = isMobile ? false : isRailZone || userCollapsed;

  const toggleCollapse = useCallback(() => {
    setUserCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* storage unavailable — keep in-memory state */
      }
      return next;
    });
  }, []);

  // Mobile drawer: focus first control on open, Escape to dismiss, restore
  // focus to the opener on close.
  const drawerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!mobileOpen || !isMobile) return;
    const drawer = drawerRef.current;
    const firstFocusable = drawer?.querySelector<HTMLElement>("a, button");
    const previouslyFocused = document.activeElement as HTMLElement | null;
    firstFocusable?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMobileClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [mobileOpen, isMobile, onMobileClose]);

  const content = (
    <SidebarContent rail={false} mobile onNavigate={onMobileClose} />
  );

  // Mobile: dialog-style overlay drawer.
  if (isMobile) {
    return (
      <>
        <div
          className={cn(
            "fixed inset-0 z-40 bg-slate-900/50 transition-opacity duration-fast",
            mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={onMobileClose}
          aria-hidden="true"
        />
        <aside
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          inert={!mobileOpen}
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-card shadow-xl transition-transform duration-normal ease-emphasized",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {content}
        </aside>
      </>
    );
  }

  // Desktop: sticky aside, switches between expanded and rail.
  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-border/70 bg-card transition-[width] duration-fast",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      <SidebarContent
        rail={collapsed}
        mobile={false}
        onToggleCollapse={toggleCollapse}
        canCollapse={!isRailZone}
      />
    </aside>
  );
}
