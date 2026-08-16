import { FileText, ShieldCheck } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/layout/role-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatAuditAction,
  formatDateTime,
  getInitials,
  humanizeField,
} from "@/lib/format";
import type { AuditLogEntry } from "@/lib/types";

/*
 * AuditEntryDialog — read-only detail view of a single audit-log entry.
 * Shows the actor, target, and the before/after field diff when one exists.
 */

interface AuditEntryDialogProps {
  entry: AuditLogEntry | null;
  actorName?: string;
  onOpenChange: (open: boolean) => void;
}

function formatDiffValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function DiffLine({
  label,
  value,
  after,
}: {
  label: string;
  value: unknown;
  after: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className={`w-14 shrink-0 text-xs font-medium ${
          after ? "text-teal-700" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      <span
        className={`font-mono text-xs leading-relaxed ${
          after ? "text-teal-700" : "text-muted-foreground"
        }`}
      >
        {formatDiffValue(value)}
      </span>
    </div>
  );
}

export function AuditEntryDialog({
  entry,
  actorName,
  onOpenChange,
}: AuditEntryDialogProps) {
  if (!entry) return null;

  const diff = entry.diff;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-md shadow-sky-600/30">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-lg">
                {formatAuditAction(entry.action)}
              </DialogTitle>
              <DialogDescription className="mt-0.5">
                {formatDateTime(entry.timestamp)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Metadata */}
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 rounded-lg border border-border bg-muted/40 p-4 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Actor</dt>
            <dd className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarFallback className="text-[10px]">
                  {getInitials(actorName)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{actorName ?? entry.actorId}</span>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Role</dt>
            <dd>
              <RoleBadge role={entry.actorRole} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Target type</dt>
            <dd className="text-sm font-medium">{entry.targetType}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Target ID</dt>
            <dd
              className="max-w-[200px] truncate font-mono text-xs text-muted-foreground"
              title={entry.targetId}
            >
              {entry.targetId}
            </dd>
          </div>
        </dl>

        {/* Field changes */}
        <section className="rounded-lg border border-border">
          <h3 className="flex items-center gap-1.5 border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            Changes
          </h3>
          {!diff || Object.keys(diff).length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No field changes were recorded for this action.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {Object.entries(diff).map(([field, change]) => (
                <div key={field} className="px-4 py-3">
                  <p className="text-sm font-medium text-foreground">
                    {humanizeField(field)}
                  </p>
                  <div className="mt-2 space-y-1.5">
                    <DiffLine label="Before" value={change.before} after={false} />
                    <DiffLine label="After" value={change.after} after />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
