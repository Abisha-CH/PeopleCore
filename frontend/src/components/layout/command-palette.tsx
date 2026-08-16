import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

import { useAuth } from "@/providers/auth-provider";
import { NAV_BY_ROLE } from "@/config/nav";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// spec §3.12: Command palette — Ctrl+K global, modal overlay centered,
// max-w-lg, search input auto-focused, lists nav links

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { role } = useAuth();
  const navigate = useNavigate();

  // Ctrl+K trigger
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const navItems = useMemo(() => {
    if (!role) return [];
    return NAV_BY_ROLE[role].flatMap((section) =>
      section.items.map((item) => ({ ...item, section: section.title })),
    );
  }, [role]);

  if (!role) return null;

  const grouped = navItems.reduce(
    (acc, item) => {
      (acc[item.section] ??= []).push(item);
      return acc;
    },
    {} as Record<string, typeof navItems>,
  );

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            onClick={() => setOpen(true)}
            className="group h-9 w-9 justify-between gap-2 rounded-lg border-border/70 bg-card/70 px-0 text-sm font-normal text-muted-foreground shadow-xs hover:border-brand-300/60 hover:bg-card hover:text-foreground hover:shadow-card sm:w-52 sm:px-3"
            aria-label="Search pages"
          >
            <span className="hidden items-center gap-2 sm:flex">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-brand-50 to-indigo-100 text-brand-600 transition-colors group-hover:from-brand-100 group-hover:to-indigo-200">
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span>Search pages…</span>
            </span>
            <Search className="h-4 w-4 sm:hidden" aria-hidden="true" />
            <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Search pages (Ctrl+K)</TooltipContent>
      </Tooltip>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {Object.entries(grouped).map(([section, items]) => (
            <CommandGroup key={section} heading={section}>
              {items.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`${item.label} ${item.href}`}
                  onSelect={() => {
                    navigate(item.href);
                    setOpen(false);
                  }}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
