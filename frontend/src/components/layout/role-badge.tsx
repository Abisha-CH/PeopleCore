import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, type Role } from "@/lib/auth";

// Semantic role chips: admin=blue (info), manager=amber (warning),
// employee=teal. Unknown roles (e.g. legacy actor roles in the audit log)
// fall back to the neutral slate chip. Labels always use the human
// role names; never raw role keys.
const ROLE_BADGE_VARIANT: Record<Role, "info" | "warning" | "teal"> = {
  admin: "info",
  manager: "warning",
  employee: "teal",
};

const KNOWN_ROLES = Object.keys(ROLE_BADGE_VARIANT) as Role[];

export function RoleBadge({ role }: { role: string }) {
  const known = KNOWN_ROLES.includes(role as Role);
  const variant = known ? ROLE_BADGE_VARIANT[role as Role] : "neutral";
  const label = known ? ROLE_LABELS[role as Role] : role;
  return <Badge variant={variant}>{label}</Badge>;
}
