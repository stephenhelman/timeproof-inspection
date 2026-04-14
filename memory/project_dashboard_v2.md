---
name: Dashboard v2 & Lead Notes
description: Second major feature pass — real dashboard, inspections tab, Lucide icons, lead notes, interactive call script
type: project
---

Second feature pass completed on top of the Lead Management system.

**Why:** Dashboard was a simple inspection list; needed analytics, proper nav, and lead notes for revival workflow continuity.

## Schema additions
- `LeadNote` model: id, leadId, content (Text), phase?, authorName?, authorId?, createdAt + @@index([leadId])
- `notes LeadNote[]` added to Lead model

## API additions
- `GET /api/inspection` — list inspections for current user with optional status filter
- `POST /api/lead/[id]/notes` — create a LeadNote (content + optional phase key)
- `GET /api/lead/[id]` now includes `notes: { orderBy: createdAt desc }`

## Nav (app/(app)/layout.tsx)
- Uses lucide-react throughout
- Logo = home (no Dashboard text link)
- Desktop: Logo | Inspections | Leads | Revival[amber badge] → right: View Card button | avatar | sign-out icon
- Mobile: second scrollable row with same links + Card
- Revival badge scoped by user role (REP sees only their leads)

## Dashboard (/dashboard)
- 6 stat cards: Total Leads | Revival Pending | Recovered | Inspections | Report Views | Lead Revenue (sum highestEstimateValue)
- Revival funnel section: Total / Called / Recovered / Not Interested / No Answer + stacked progress bar (emerald/orange/zinc)
- Recent Leads (last 5) + Recent Inspections (last 5) side by side
- Empty state CTA for first-time users
- Business card widget removed

## Inspections tab (/inspections)
- Client component, calls GET /api/inspection
- Search by customer/address/rep + status filter (draft/complete)
- Table with: Customer | Address | Rep | Status badge | Views | Date
- "New Inspection" button in header

## Settings page
- Business Card section added at top: Edit Card → /dashboard/profile, View Live Card → /card/[userId]
- Lucide icons: Pencil, ExternalLink

## Lead notes (lead detail + call script)
- `LeadNotesPanel` component in leads/[id]/page.jsx: phase selector, textarea + send button, chronological note timeline
- Phase keys: general | opener | phase_1 through phase_5

## CallScriptModal (src/components/revival/CallScriptModal.jsx)
- Now accepts `leadId` prop
- 4 tabs: Script | Notes | Objections | Framework
- Notes tab: phase context from active script phase, textarea + save, phase-filtered notes, collapsible "All notes" summary
- "+ Add Note" shortcut button in Script tab phase bar
- Inline SVGs replaced with lucide-react (X, Send, ChevronDown/Up)
- Both revival/page.jsx and leads/[id]/page.jsx pass leadId to modal
