# PeopleCore — Design System

Frontend-only visual language for PeopleCore. Backend behavior, APIs, auth,
and business rules are out of scope for this document.

## Direction

Premium SaaS: indigo/violet/cyan/teal accents on slate + white neutrals, soft
gradients, layered cards, soft shadows. ~65–75% neutral surfaces, ~25–35%
accent.

## Palette semantics

| Surface | Token | Where |
|---|---|---|
| Neutral base | `bg-background` (white) | app canvas |
| Neutral panels | `bg-card`, `bg-muted` | cards, table rows, chip fills |
| Primary / brand | `brand` ramp (indigo–blue) | buttons, links, active nav, payroll |
| Employees | `violet` ramp | employee icon chips, hero gradients |
| Leave | `teal` / `cyan` | leave type chips, leave icon chips |
| Pending approvals | `amber` | pending statuses, stat accents |

Status badges are never color-only: dot + text, semantic fills (pending
amber, approved emerald, rejected rose). Badge variants live in
`components/ui/badge.tsx` (`info`, `success`, `warning`, `destructive`,
`neutral`, `teal`).

## Component vocabulary

- **Page header**: title + icon chip + subtitle + action. Icon chips are
  category-tinted: payroll=brand, employees=violet, leave=teal, pending=amber.
- **Stat cards**: `bg-card` panel, tinted icon chip, `tabular-nums` value.
- **Tables**: neutral header row, striped rows (`even:bg-muted/50`), muted
  metadata text (`text-muted-foreground text-sm`), `tabular-nums` for
  numeric cells, semantic badges, `Pagination` footer, `QueryState` for
  loading / error / empty.
- **Row actions**: single-action rows use a direct ghost icon button
  (`size="icon-sm"`, e.g. Eye); multi-action rows use a kebab `DropdownMenu`
  with icon + label items.
- **Dialogs**: gradient header strip + icon chip; definition lists with
  `divide-y`; section headers are small-caps with tinted icons (summary
  emerald, deductions violet).
- **Empty states**: `EmptyState` with dashed wrapper + icon + title +
  description; in-table empty branches are dead code — empty data is handled
  by `QueryState` only.
- **Feedback**: `page-loader` / `page-error` panels share card geometry:
  `rounded-xl border border-border/80 bg-card shadow-card`.
- **Tabs**: `duration-fast` transitions; active trigger is
  `bg-background text-brand-700 shadow-sm`.
- **Identity**: `RoleBadge` is the single shared badge for roles —
  admin=info (blue), manager=warning (amber), employee=teal, unknown=neutral.
  Avatar tones cycle the accent ramps via `avatarToneClass`.

## Rules

- Never display raw Firebase IDs. Employee line managers render via
  `lineManagerLabel` (name, else "Manager unavailable", else "No manager
  assigned").
- Shadows need offset + soft blur (`shadow-card`, `shadow-md shadow-x-600/30`
  on gradient chips). No flat hard shadows.
- No gradient text for emphasis.
- Body copy stays readable (`text-sm` in tables/dialogs, `text-muted-foreground`
  for secondary info).
- One authored motion moment per surface; reduced-motion respected via
  `motion-reduce:`.
- Functional behavior is untouched by this pass: no API, schema, auth, RBAC,
  or business-rule changes.

## Verification

- `npm run typecheck` (frontend + backend), `npm run lint`, `npm test`,
  `npm run build` (frontend), `npm run test:e2e` (root, Playwright).