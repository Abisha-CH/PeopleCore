# PeopleCore — Product Context

## What it is

PeopleCore is a web-based HR management system for companies with 100–200 employees. It centralises employee record management, leave management, and payroll into a single role-controlled application.

## Platform

Web only. Desktop browsers (Chrome, Firefox, Edge — latest two versions). No mobile UI for the current release. Future mobile support may be considered later but must not influence current design decisions.

## Users

Three roles, each with a distinct workflow surface:

**HR Admin** — the power user. Manages all employee records, configures leave types and entitlements, approves leave at the final stage, generates and publishes payslips, and reviews the audit log. Accesses every part of the system.

**Line Manager** — an elevated employee. Reviews and acts on leave requests from their direct reports at the first stage before HR Admin final approval. Otherwise has the same access as a regular employee for their own data.

**Employee** — the frequent casual user. Submits and tracks leave, views payslips, updates their phone number. Touches the system regularly but only ever sees their own data.

## Visual direction

Clean, modern enterprise application. Feels professionally designed — not template-based, not AI-generated. Prioritise usability, consistency, and accessibility over visual novelty.

**Avoid:** oversized hero sections, excessive gradients, glassmorphism, glowing cards, floating blobs, unnecessary animations, emoji-heavy interfaces, repetitive card-grid layouts, lorem ipsum, decorative elements without purpose.

**Aim for:** polished commercial HR platform aesthetics — the kind you'd trust with real employee data. Interfaces that feel considered and complete, not assembled.

## Branding and palette

- **Primary accent:** blue (mid-weight, professional — not electric, not muted)
- **Surfaces:** white and light gray (`slate-50` / `gray-50` range)
- **Borders:** subtle, consistent (`border-border` / `slate-200` range)
- **Text:** near-black primary, gray secondary, muted tertiary
- **Status colours:** standard semantic — green for approved/active, amber for pending, red for rejected/inactive, gray for cancelled/draft

## Typography

**Inter** exclusively. Restrained hierarchy:
- Page titles: `text-xl font-semibold` or `text-2xl font-semibold`
- Section headings: `text-base font-semibold` or `text-sm font-semibold uppercase tracking-wide text-muted-foreground`
- Body: `text-sm` (14px base throughout the app)
- Labels and metadata: `text-xs text-muted-foreground`

No decorative fonts. No display sizes outside of page titles. No all-caps body text.

## Design system

**Tailwind CSS + shadcn/ui.** Components customised where the default appearance is too generic — do not ship default shadcn button, card, or badge appearances unchanged when the context calls for refinement.

**Icons:** Lucide React only. Consistent sizing (`h-4 w-4` inline, `h-5 w-5` standalone actions). No icon overuse — icons support labels, they do not replace them in data-dense contexts.

## Layout principles

- Fixed left sidebar navigation, persistent across all authenticated views
- Top bar with current user identity and context (role badge, name)
- Content area: max-width constrained, generous internal padding, no full-bleed content except the auth screen
- Tables for lists of records — not card grids. Cards for summary metrics only.
- Forms: two-column on wider breakpoints for longer forms; single-column for short flows
- Modals and sheets for in-context actions (approve/reject, quick edit); full pages for create/edit of primary records

## Tone

Professional and direct. No motivational copy, no friendly onboarding fluff in the production UI. Labels name things precisely. Error messages say what happened and what to do.

## Key surfaces (priority order)

1. Authentication (login, password reset)
2. HR Admin Dashboard
3. Employee Dashboard
4. Line Manager Dashboard
5. Employee list and employee detail/edit
6. Leave request list (HR Admin view)
7. Leave request submission (Employee)
8. Leave approval (Line Manager + HR Admin)
9. Payroll profiles
10. Payslip generation and publish
11. Payslip view (Employee)
12. Leave configuration (types, entitlements, overrides, public holidays)
13. Audit log

## What done looks like

Every screen looks production-ready: realistic data, meaningful hierarchy, correct empty states, consistent spacing, and no placeholder content. If it looks like a demo, it is not done.
