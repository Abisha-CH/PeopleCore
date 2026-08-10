import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, type Role } from "@/lib/auth";

// spec §3.5: badges for role display; always includes the status word
// Roles use the neutral variant per design's badge system

export function RoleBadge({ role }: { role: Role }) {
  return <Badge variant="neutral">{ROLE_LABELS[role]}</Badge>;
}
