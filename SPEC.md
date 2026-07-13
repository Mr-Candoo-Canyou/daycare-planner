# Iqaluit Daycare Network

**Centralized Enrollment & Operations Platform — Product Requirements Specification**

**Version 2.1 — July 2026** (supersedes v2.0)

---

## Changelog: v2.0 → v2.1 (review findings)

This revision resolves inconsistencies found in review and fills specification gaps that would have surfaced as design questions mid-build.

| # | Change | Rationale |
|---|--------|-----------|
| 1 | Version/date corrected (v2.0 title page still said "Version 1.0 — March 2026"). | Document hygiene; the filename and title page disagreed. |
| 2 | Fixed broken cross-references in *Next Steps* (pointed at "Open Questions (Section 7)"; they are Section 8) and removed already-resolved items ("web app vs. native mobile" was decided in §7.1). | Stale steps invite re-litigating settled decisions. |
| 3 | **Concurrent offers** behavior defined (§4.2.5). | Previously undefined; guaranteed to occur in practice. |
| 4 | **Accepting the #1 choice** explicitly ends the application (no holding fee applies, all other waitlist entries released) (§4.2.3). | Was only derivable by implication. |
| 5 | Holding fee edge cases specified: per-list selection, grace period, no refunds mid-term, fee waived case (§4.2.4). | "Stops paying → removed" was the only failure mode described. |
| 6 | **Withdrawal flow** added (§4.2.6). | Families leave Iqaluit or find other care; no exit path existed. |
| 7 | **Age-group transitions** addressed (§4.2.7). | Children age between infant/toddler/preschool while waitlisted; positions must carry over. |
| 8 | Single-role-per-account constraint flagged and relaxed to *one role per daycare-scope, multiple role grants per account* (§7.5). | In a town of 8,500, daycare staff are frequently also applicant parents. Forcing two accounts breaks notification delivery and audit trails. |
| 9 | Privacy stance reframed: v2.0 asserted PIPEDA/ATIPP "not identified as directly governing." That is a legal conclusion the project team is not positioned to make; §7.4 now requires a privacy review before production launch and treats consent/retention as requirements regardless. | Handling children's health data + Indigenous identity markers is the highest-sensitivity data class this platform touches. |
| 10 | Waitlist position volatility disclosure added (§4.2.2): positions can move *backward* (priority tiers, manual reordering, new higher-priority applicants). | v2.0 promised transparency but the UI implication (positions only improve) would have been misleading. |
| 11 | "Real-time updates" reconciled with offline-first: stale-data indicators specified (§7.3). | The two requirements contradict each other without a freshness rule. |
| 12 | Offer expiry defined precisely: expiry timestamp computed at offer creation in America/Iqaluit timezone; enforced server-side (§4.2.3). | "One week" is ambiguous across DST and client clocks. |
| 13 | Data entity list completed: `Notification`, `AuditLogEntry`, `FormSchema`, `PolicyTemplate`, `BroadcastMessage` added; `HoldingFeeRecord` keyed per waitlist entry, not per child (§6). | v2.0's entity list could not support §4.8.1, §4.9, or the per-list holding-fee selection. |
| 14 | Non-functional requirements section added (§7.8): browser support, performance budget, backup/recovery, uptime target. | Absent entirely from v2.0. |
| 15 | Success metrics added (§10). | "Done" was undefined. |

---

## 1. Project Overview

The Iqaluit Daycare Network (IDN) platform is a centralized, web-based application serving the daycare ecosystem of Iqaluit, Nunavut (population approx. 8,500). The system enables families to apply to multiple daycare providers through a single unified process, while preserving each daycare's autonomy over its own admissions policies, waitlists, and operations.

The platform serves six distinct user roles with carefully scoped permissions, replacing fragmented paper and ad-hoc processes with a transparent, equitable, and efficient digital system.

## 2. Strategic Goals

- Reduce the administrative burden on families by providing a single application for all daycares in Iqaluit.
- Improve transparency: parents always know where their child stands globally and at each specific daycare.
- Respect daycare autonomy: each provider retains full control of their waitlist, priority rules, and enrolment policies.
- Support culturally appropriate priority systems (e.g. Indigenous community membership, sibling priority).
- Provide funders and government bodies with aggregate data to plan capacity and support underserved families.
- Enable community development: parents can flag themselves as willing to start a new daycare organization, connecting them with funders and each other.

## 3. User Roles & Permissions

| Role | Description & Scope |
|------|---------------------|
| **Prospective Parent** | Families exploring daycare options before applying. Can view all daycare profiles and programs. No access to waitlist data until they apply. |
| **Enrolled Parent** | Families with an active application or enrolled child. Full access to their own waitlist positions, offers, and child records. |
| **Daycare Staff** | Frontline staff at a specific daycare. Can view and manage only children who have applied to their own centre. |
| **Daycare Admin** | Director-level staff at a specific daycare. All staff permissions plus: manage priority rules, configure waitlist policy, view enrolment reports. |
| **Funder / Government** | Government bodies and grant organizations. Aggregate, anonymized system-wide data. Can view the identity and contact information of parents who have flagged themselves as willing to start a new daycare, and can message them through the platform. No access to individual child records beyond this. Funder role access is governed by the IT Administrator. |
| **IT Administrator** | Platform-level superuser. Manages daycare onboarding, user accounts, system configuration, and audit logs. No access to child-level data except for troubleshooting with consent. |

An account may hold multiple role grants (see §7.5) — e.g. a daycare staff member who is also an applicant parent — but each grant is scoped independently and the UI presents one active role context at a time.

## 4. Functional Modules

### 4.1 Daycare Directory & Profiles

A publicly accessible directory of all participating daycares in Iqaluit. No login required to browse.

Each daycare profile includes:

- Name, location, contact information, and photos
- Age groups served and licensed capacity
- Programming philosophy and curriculum approach
- Fees and subsidy acceptance information
- Hours of operation
- Current availability status (Open, Waitlist Only, Closed to Applications)
- Languages of instruction / cultural programming offered

### 4.2 Centralized Application & Ranked-Choice Enrolment

The core innovation of the platform. Parents submit one application per child and rank their preferred daycares in order of preference.

#### 4.2.1 Application Flow

1. Parent creates an account and completes a child profile. The fields in the unified application are configurable by the IT Administrator, allowing the form to evolve over time without a code change. Default fields: child name, DOB, age group needed, desired start date, and optional priority criteria (Indigenous community membership, sibling currently enrolled). The IT Administrator can add, remove, reorder, or relabel fields, and mark fields as required or optional.
2. Parent browses the directory and adds daycares to their list, ranking them 1st choice through Nth choice.
3. Parent submits the application. Each selected daycare receives a new application entry for that child — they can see only the information relevant to their own centre (never the parent's ranking or the other daycares applied to).
4. There is no application fee. Any family may apply at no cost.
5. Parents may edit their ranking while the application is active. Re-ranking never resets the *date added* on existing waitlist entries; adding a new daycare creates a new entry dated at the time it is added.

#### 4.2.2 Waitlist Visibility for Parents

- Parents can see their position on each individual daycare's waitlist (as managed by that daycare).
- Parents can see a global view: total children ahead of them across all their ranked daycares vs. total available spots across those daycares.
- Waitlist positions update in real time when offers are made and accepted/declined elsewhere in the system.
- **Positions can move backward as well as forward.** Priority tiers, manual reordering by daycare admins, and new applicants with higher priority can all push a child down a list. The UI must communicate that a position is a snapshot, not a guarantee, and must never imply monotonic progress.
- Over time, as the system accumulates historical turnover data, parents will see a projected likelihood and estimated timeframe for receiving an offer at each daycare, based on historical spot availability, current waitlist depth, and age-group demand. Projections are clearly labelled as estimates and are suppressed entirely until a minimum data threshold is met (at least one full year of turnover history per daycare).

#### 4.2.3 Offer & Acceptance Flow

- When a spot becomes available, the daycare admin makes an offer to the next eligible child on their waitlist according to their priority rules.
- The parent is notified across channels in priority order: (1) SMS, (2) push notification if installed, (3) email. All three channels are attempted for critical events (spot offer, expiring acceptance window). Parents without a mobile number on file receive push and email.
- The offer window defaults to 7 days, adjustable system-wide by the IT Administrator. **The expiry timestamp is computed at offer creation in the America/Iqaluit timezone and enforced server-side**; client clocks are never trusted. The countdown shown to parents derives from the server timestamp.
- If the parent **accepts** an offer from their **1st-choice** daycare: the application is fulfilled. The child is enrolled, and all other waitlist entries for that child are released. No holding fee is involved.
- If the parent **accepts** an offer from a lower-ranked daycare:
  - The child is enrolled at the offering daycare.
  - The child is automatically removed from the waitlists of all daycares ranked *below* the offering daycare.
  - The child may remain on the waitlists of daycares ranked *above* the offering daycare, subject to the holding fee (§4.2.4). The parent chooses which higher-ranked lists to retain at acceptance time.
- If the parent **declines** the offer, or the window **expires**:
  - The spot is offered to the next eligible child on that daycare's waitlist.
  - The child remains on all their original waitlists (a decline at one daycare never affects standing elsewhere).
- Daycares are never told why a list moved: acceptance elsewhere, withdrawal, and holding-fee lapse are all presented identically as the list advancing.

#### 4.2.4 Holding Fee for Higher-Ranked Waitlists

- After accepting a spot at a lower-ranked daycare, parents may pay an annual holding fee to remain on higher-ranked waitlists. The fee is set by the IT Administrator (in consultation with daycares) and applies **per child per year**, regardless of how many higher-ranked lists are retained.
- At acceptance time the parent selects which higher-ranked waitlists to retain; unselected entries are released immediately.
- The fee must be paid within the acceptance window. A **7-day grace period** applies to renewal payments; if the grace period lapses, the retained entries are released. Released entries are not restorable — rejoining means reapplying with a new date.
- If a spot opens at a retained higher-ranked daycare and the parent accepts, the transition is seamless: the new enrolment starts, the spot at the lower-ranked daycare is released, and any remaining retained entries above the *new* daycare persist under the same holding-fee term. Fees are not refunded or prorated when a transition occurs or when the parent voluntarily releases entries.

#### 4.2.5 Concurrent Offers

Multiple daycares can offer to the same child at once. Rules:

- All open offers are visible to the parent together, ordered by the parent's ranking.
- Accepting an offer automatically declines all open offers from daycares ranked *below* the accepted one, and leaves offers from higher-ranked daycares open until they expire or are answered (accepting a higher-ranked open offer supersedes: the just-accepted lower spot is released as in §4.2.4).
- The system never auto-accepts on the parent's behalf.

#### 4.2.6 Withdrawal

- A parent can withdraw a child's application (entirely, or from individual daycares) at any time. Withdrawal takes effect immediately, releases the affected waitlist entries, and cancels open offers at those daycares.
- Withdrawal is presented to daycares as the list advancing, with no reason shown (§5, Data Minimization).
- An IT Administrator can archive applications that have been inactive past a configurable period (default 24 months) after notifying the parent.

#### 4.2.7 Age-Group Transitions

- A child's *age group needed* is derived from DOB and desired start date, not stored statically. When a waitlisted child crosses an age-group boundary, their waitlist entries persist with original dates; daycares see the child under the correct current age group.
- If a daycare does not serve the child's new age group, the entry is flagged to the parent (not silently removed) so the family can decide whether to withdraw it.

### 4.3 Daycare Waitlist Management

Each daycare admin manages their own waitlist independently. The platform enforces the inter-daycare rules (automatic removal on acceptance) but does not override individual daycares' internal priority logic.

- Daycare admins configure their priority tiers using pre-made policy templates provided by the platform. Templates cover common Iqaluit scenarios: **(a) Siblings First**, **(b) Indigenous Community Priority**, **(c) Staff Children**, **(d) Neighbourhood Residents**, **(e) General FIFO**. Admins can select one or more templates, combine and reorder tiers, customize tier labels and descriptions, and create custom tiers from scratch.
- Within each tier, ordering defaults to application date but can be manually adjusted by the admin. Manual adjustments are recorded in the audit log with the acting admin's identity.
- Admins view each applicant's profile with only information relevant to their centre — never where else the child applied or how the family ranked this daycare.
- Admins can add notes, flag applications, or mark children as ineligible for their centre (with a required internal reason, visible in the audit log; the parent sees the entry as *inactive at this daycare*).
- When a spot opens, the system surfaces the next eligible child per the configured priority rules; the admin confirms and triggers the offer.

### 4.4 Enrolled Child Management *(v2 scope)*

Once a child is enrolled at a daycare, the platform supports ongoing operational management: child profile (emergency contacts, health information, allergies, custody notes), daily attendance, incident and health reports visible to parents, document storage (immunization records, permission forms, subsidy approvals), and in-platform parent-staff messaging.

### 4.5 Digital Check-In / Check-Out *(v2 scope)*

A web-based attendance sheet replaces paper sign-in. Staff toggle each enrolled child present/absent daily with optional absence reasons; admin corrections to past dates are audit-logged; attendance feeds subsidy reporting (§4.7); the sheet works offline and syncs when connectivity returns.

### 4.6 Staff Scheduling & Clock-In / Clock-Out *(v2 scope)*

Admins build and publish weekly staff schedules (staff notified via SMS/push/email); staff clock in/out digitally; admins export hours reports per pay period; staff see only their own schedules and hours.

### 4.7 Subsidy Tracking & Reporting *(v2 scope)*

Tracks subsidy status per child (FNICCI, Nunavut territorial; multiple concurrent subsidies supported) with approval references, amounts, dates, and renewal reminders; expiry alerts to admins; attendance-backed claim reports exportable as PDF/CSV; aggregate utilization on the funder dashboard.

### 4.8 Funder & Government Dashboard

A read-only aggregate view of system-wide data. No individual child data is accessible.

- Total licensed capacity vs. current enrolment across all daycares.
- Aggregate waitlist length by age group and neighbourhood.
- Subsidy utilization rates by daycare *(v2, once §4.7 exists)*.
- Demographic summaries (anonymized): age distribution, Indigenous enrolment rates (where disclosed). **Small-cell suppression applies**: any aggregate bucket with fewer than 5 children is reported as "<5" to prevent re-identification in a small community.
- Report generation: export to CSV or PDF for grant reporting.

#### 4.8.1 Unplaced Family Outreach Tool

- Any parent can flag themselves on their profile as willing to help start a new daycare organization. This is an active, intentional declaration. By flagging, they consent to funders seeing their name and contact information; the consent text states this explicitly at the moment of flagging.
- Funders see the list of flagged parents with contact details and can send broadcast messages (planning meetings, grant information) through the platform.
- Parents can remove the flag at any time; removal immediately hides their identity from funders and stops further messages.
- For all other parent data, funders see only aggregates. Individual child records remain inaccessible to funders at all times.

### 4.9 IT Administration

- Onboard new daycare providers (create accounts, configure profile, set capacity).
- Manage all user accounts and role grants.
- Configure system-wide settings: offer window duration (default 7 days), annual holding fee amount, holding-fee grace period, archive-after-inactivity period, SMS provider credentials, push provider credentials.
- Manage the unified application form: add, remove, reorder, and configure fields (label, type, required/optional) without a code deployment.
- Manage the library of pre-made waitlist policy templates available to daycare admins.
- View audit logs for all system actions.
- Manage platform uptime, backups, and integrations.

## 5. Key Design Principles

| Principle | Design Implication |
|-----------|--------------------|
| **Data Minimization** | Each role sees only what it needs. Daycares cannot see cross-daycare application data, rankings, or why a list advanced (acceptance elsewhere, withdrawal, and fee lapse all look identical). Funders see only aggregates, with small-cell suppression. |
| **Daycare Autonomy** | Daycares fully control their priority rules and waitlist ordering. The platform enforces inter-daycare mechanics only. |
| **Parent Transparency** | Parents always have a clear, real-time view of where they stand — at each daycare and globally — including honest communication that positions can move backward. |
| **Cultural Sensitivity** | Priority rules accommodate Indigenous community membership and other culturally relevant criteria without requiring sensitive data to be shared broadly. |
| **Accessibility** | UI must be usable on mobile devices with limited connectivity. i18n architecture from the start; English at v1 launch, Inuktitut addable via translation file alone. |
| **Clear Communication** | All fee structures, waitlist rules, and acceptance deadlines are communicated clearly at every step to avoid confusion and missed offers. |

## 6. Core Data Entities

| Entity | Key Attributes |
|--------|----------------|
| **Child** | ID, name, DOB, parent(s), priority criteria (sibling, Indigenous membership), current enrolment status. Health info is v2 (enrolled-child management). |
| **Application** | Child ID, ranked list of daycares, submission date, status (pending / offered / accepted / enrolled / withdrawn). |
| **WaitlistEntry** | Application ID, Daycare ID, rank given by parent, priority tier, position within tier, date added, status (active / inactive / released), notes, flags. |
| **Offer** | WaitlistEntry ID, offer date, expiry timestamp (server-computed, America/Iqaluit), response (accepted / declined / expired / superseded). |
| **Daycare** | ID, name, capacity by age group, priority rule config, availability status, contact info, profile content. |
| **HoldingFeeRecord** | Child ID, retained WaitlistEntry IDs, payment status, term start/end, renewal date, grace-period state. |
| **Enrolment** | Child ID, Daycare ID, start date, status (active / ended). |
| **User** | ID, role grants (role + optional daycare scope), linked entities (parent → children), contact info (email + optional mobile), notification preferences, willing-to-start-daycare flag + flag timestamp. |
| **FormSchema** | Versioned JSON schema for the unified application form; edited by IT Administrator; submissions record the schema version they were captured under. |
| **PolicyTemplate** | ID, name, description, tier definitions; managed by IT Administrator, instantiated by daycare admins. |
| **Notification** | User ID, event type, channels attempted with per-channel outcome, timestamps, read state. |
| **BroadcastMessage** | Funder ID, recipient flagged-parent IDs (snapshot at send time), body, sent timestamp. |
| **AuditLogEntry** | Actor, action, entity reference, before/after summary, timestamp. Append-only. |

## 7. Technical Architecture

### 7.1 Delivery Model

Progressive Web App (PWA): installable, push-capable, offline-capable, one codebase instead of three. If push reliability proves insufficient in Iqaluit's connectivity conditions, the PWA can be wrapped with Capacitor for store distribution and native notification delivery without a rewrite.

Key offline features (viewing waitlist positions, reading notifications; attendance in v2) queue actions locally and sync when connectivity returns.

### 7.2 Technology Stack

- **Frontend:** React + TypeScript + Vite.
- **Styling:** Tailwind CSS.
- **Backend & Database:** Supabase (self-hosted) — PostgreSQL, auth, row-level security, storage, real-time subscriptions.
- **Hosting:** Hetzner Cloud (see §7.4 for the data-residency risk).
- **SMS:** Twilio. **Push:** Firebase Cloud Messaging.
- **i18n:** i18next; all user-facing strings externalised from the first line of code.
- **Version control:** GitHub, private repository.

The frontend accesses all data through a **repository interface** (a thin data-access layer). v1 development and demos can run against a local adapter (in-browser persistence with seeded data); the Supabase adapter implements the same interface. This keeps the domain logic — especially the waitlist engine — independent of the backend and unit-testable.

### 7.3 System Architecture Overview

- The React PWA talks to Supabase via its client SDK; RLS policies enforce §3's role scoping on every table.
- Business logic that RLS cannot express (ranked-choice cascade on acceptance, holding-fee validation, offer expiry) runs in Supabase Edge Functions (Deno/TypeScript) triggered by database events or API calls. **Offer expiry is enforced by a scheduled server-side job**, not by clients noticing a lapsed countdown.
- Notifications dispatch from Edge Functions (Twilio, FCM) on offer events.
- The configurable application form is a versioned JSON schema in the database, rendered dynamically; the IT Administrator edits it through an admin UI.
- Offline support via a service worker (Workbox): app-shell caching, queued writes in IndexedDB. **Freshness rule:** any data rendered from cache while offline or stale (>60s since last sync) is visibly marked "as of <time>"; waitlist positions and offer countdowns must never display cached values as live.

### 7.4 Data Residency & Privacy

- **Known risk:** Hetzner data centres are in Germany, Finland, and the US; Canadian data residency is not guaranteed. Accepted for v1; migration path to a Canadian VPS (OVH Canada, Vultr Montreal) requires infrastructure reconfiguration only, no application code changes.
- **Privacy review required before production launch.** This platform stores children's personal information and self-declared Indigenous identity. Whether PIPEDA, Nunavut's ATIPPA, or funder-imposed conditions apply is a legal determination that must be made by qualified counsel — not assumed away. Until then the platform is built to the stricter posture: explicit consent at collection, purpose limitation, deletion on request, and a documented retention schedule.
- All data in transit encrypted (TLS); at rest encrypted (PostgreSQL). Supabase Auth handles credentials (bcrypt); no plaintext passwords.
- Indigenous community membership is self-declared, unverified in-platform (daycares verify offline per their own rules). It is visible only to the daycare(s) the family applied to, never shared across daycares, never visible to funders, and appears in aggregates only where disclosed and above the small-cell threshold (§4.8).

### 7.5 Authentication & Roles

- Supabase Auth with email + password; magic-link login supported as a low-friction option.
- An account holds one or more **role grants**; each grant is a role plus (for daycare roles) a daycare scope. A staff member at Daycare A who is also an applicant parent has two grants on one account and switches context explicitly in the UI; data access is enforced per-grant by RLS. Staff at Daycare A can never access Daycare B's data.
- The IT Administrator role is created manually at platform setup. **Minimum two IT Administrator accounts** to avoid a single point of failure.
- All authentication events (login, password reset, role-grant change) are written to the audit log, visible only to IT Administrators.

### 7.6 Development Approach

Iterative, feature-by-feature build order for v1 (enrollment and waitlist scope only):

1. Project scaffolding: React + TypeScript + Vite + Tailwind + i18next + PWA service worker; repository-interface data layer.
2. Authentication & role system.
3. Daycare directory & profiles (public, no login).
4. Configurable application form & child profile (JSON schema, dynamically rendered).
5. Ranked-choice waitlist engine: cascade on acceptance, holding-fee logic, concurrent-offer rules, withdrawal. Pure, unit-tested domain code.
6. Parent waitlist dashboard: per-daycare position, global view, projections placeholder.
7. Offer / accept / decline flow with multi-channel notifications.
8. Daycare admin waitlist management & priority templates.
9. Funder dashboard: aggregates with small-cell suppression, flagged-parent list, broadcast messaging.
10. IT Administrator panel: user management, form editor, template library, system settings, audit log.

### 7.7 V2 Scope (Operations Modules)

Out of scope for v1: §4.4 enrolled child management, §4.5 attendance, §4.6 staff scheduling, §4.7 subsidy tracking. §4.8's subsidy widgets activate with §4.7.

### 7.8 Non-Functional Requirements

- **Browser support:** last 2 versions of Chrome, Safari (incl. iOS), Firefox, Edge; Android WebView ≥ 100. The public directory must degrade gracefully without JavaScript beyond the SPA bootstrap (server-rendered fallback is a v2 consideration).
- **Performance budget:** first load ≤ 250 KB gzipped JS on the public directory; interactive < 5s on a throttled 3G profile (representative of Iqaluit mobile conditions).
- **Availability target:** 99.5% monthly (community-scale, single-region).
- **Backups:** nightly encrypted PostgreSQL backups, 30-day retention, restore drill quarterly.
- **Audit log:** append-only, retained ≥ 7 years (funding-audit horizon).

## 8. Resolved Decisions

Formerly "Open Questions"; all resolved with stakeholders:

1. Holding fee is annual; amount set by the IT Administrator.
2. Default offer window is 7 days; IT-Administrator adjustable.
3. No application fee.
4. Parents actively self-flag as willing to start a daycare; no automatic identification.
5. English-only at v1; i18n architecture from day one for Inuktitut and others.
6. Indigenous membership self-declared, unverified in-platform; daycares verify offline.
7. IT Administrator governs all funder-role access.
8. Daycares never see why a list advanced (acceptance elsewhere, withdrawal, fee lapse are indistinguishable).

## 9. Next Steps

1. Stakeholder sign-off on this revision (§8 decisions and the new §4.2.5–4.2.7 behaviors).
2. UX wireframing: parent application flow and daycare waitlist management view first.
3. Privacy review engagement (§7.4) — start early; it gates production launch, not development.
4. Begin iterative development per §7.6.

## 10. Success Metrics (v1)

- ≥ 80% of participating daycares' waitlists migrated onto the platform within 6 months of launch.
- ≥ 90% of offers answered within the offer window (proxy for notification reach).
- Median parent application completion time under 15 minutes.
- Zero cross-daycare or cross-role data exposure incidents.
- Funder dashboard adopted for at least one real grant-reporting cycle.
