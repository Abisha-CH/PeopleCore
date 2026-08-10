import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/*
 * Pagination — compact server-style control. Renders a page-number window
 * with first/prev/next/last shortcuts, all with accessible labels.
 */
interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function pageWindow(page: number, totalPages: number): number[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 3) return [1, 2, 3, 4, 5];
  if (page >= totalPages - 2)
    return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [page - 2, page - 1, page, page + 1, page + 2];
}

export function Pagination({ page, pageSize, total, onPageChange, className }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pages = pageWindow(page, totalPages);

  if (totalPages <= 1) return null;

  const navButton =
    "h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-between gap-4", className)}>
      <p className="text-xs text-muted-foreground">
        {total.toLocaleString()} result{total === 1 ? "" : "s"}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className={navButton}
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          aria-label="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className={navButton}
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p) => (
          <Button
            key={p}
            variant="ghost"
            size="icon-sm"
            className={cn(
              navButton,
              p === page &&
                "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover",
            )}
            onClick={() => onPageChange(p)}
            aria-current={p === page ? "page" : undefined}
            aria-label={`Page ${p}`}
          >
            {p}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="icon-sm"
          className={navButton}
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className={navButton}
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          aria-label="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
