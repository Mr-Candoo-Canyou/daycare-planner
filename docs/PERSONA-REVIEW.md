# Persona review — findings & recommendations

Four-persona exploratory test of the v1 build (2026-07-13): **parent**,
**daycare**, **privacy analyst**, **website administrator**. Method: scripted
browser sessions against the production build for each persona, plus
RLS probes against the Supabase migrations running on a real PostgreSQL
(scripts mirrored in `supabase/tests/`). Every finding below was observed,
not hypothesized.

Verdict: the core privacy walls hold — funders, anonymous visitors, and IT
admins read **zero** child rows at the database level; staff notes never
reach parents; rankings never reach daycares. The issues found are one
suppression bypass, two data-minimization leaks through side channels,
several spec'd features missing from the UI, and one waitlist-logic gap.

## Priority 1 — fix before any real data

| # | Persona | Finding | Recommendation |
|---|---------|---------|----------------|
| 1 | Privacy | **Funder CSV export bypasses small-cell suppression.** The dashboard table shows `<5`, but the exported CSV contains the raw counts (observed: `5 5 3 0`). | Run `suppressSmall()` over export rows too — same rule for every egress path (screen, CSV, PDF). One-line fix in `FunderPage.exportCsv`; the SQL `funder_overview()` already suppresses, so the export should read from it rather than recompute. |
| 2 | Privacy | **Audit log leaks child names to the IT admin.** Rows like "Maata Qanatsiaq enrolled at …" are visible in the audit tab, but SPEC §3 grants IT admins *no* child-level access. Confirmed in both the demo UI and the SQL layer (`P3` probe). | Write entity IDs into `audit_log.detail`, never names (`child c_1a2b enrolled at dc_aakuluk`). Resolve IDs to names at display time only for roles entitled to see them. |
| 3 | Privacy | **Offer notifications push the child's full name over SMS** ("Aakuluk Daycare has offered Maata Qanatsiaq a spot"). SMS is unencrypted and often previewed on lock screens. | Minimize message content on push/SMS: "You have a daycare offer waiting — sign in to respond by {date}." Full detail stays in-app and in email if the parent opts in. |

## Priority 2 — functional gaps a real user hits quickly

| # | Persona | Finding | Recommendation |
|---|---------|---------|----------------|
| 4 | Parent | **Dead end after withdrawal / no re-ranking.** A withdrawn child shows "Application withdrawn" with no re-apply path — the Apply page always creates a *new* child record. And SPEC §4.2.1(5) says parents may edit rankings on an active application; no such control exists. | Add "apply again" on the child card (reuses the child record, new application + dates) and a re-rank view on the active application (re-ranking must not reset `date_added`, per spec). |
| 5 | Daycare | **Offers are age-group blind.** Open spots are one aggregate number; "next eligible" can surface an infant when only a preschool room has a vacancy. Capacity is stored per age group but never used for offer logic. | Compute open spots per age group (capacity − enrolled − pending offers, each by derived age group) and let the admin pick which room's spot they're filling; "next eligible" then filters candidates to that age group. Needed in both `waitlist.ts` and `00002_functions.sql`. |
| 6 | Admin | **IT panel can't perform §4.9's core duties.** No daycare-onboarding UI, the Users tab has no grant/revoke controls (funder access governance is a spec requirement), and the template library is read-only. | Add: create/edit daycare (with initial admin invite), role-grant editor with confirmation + audit entry, and template CRUD. The RLS policies for all three already exist — this is UI work only. |
| 7 | Daycare | **Daycare roles get no notifications at all** (the bell is parent-only). Accepts, declines, expiries, and new applications are only discoverable by re-opening the waitlist. | Notify daycare admins on offer accepted/declined/expired and on new applications. `app.notify()` already supports any user; add the calls and show the bell for daycare grants. |
| 8 | Parent | **Age-out flagging (§4.2.7) not implemented.** When a waitlisted child crosses into an age group a daycare doesn't serve, the spec requires flagging it to the parent — nothing does. | Derive it at read time: if `age_group(child) ` has zero capacity at that daycare, badge the row "no longer serves this age group" with a leave-list prompt. |

## Priority 3 — hardening & polish

| # | Persona | Finding | Recommendation |
|---|---------|---------|----------------|
| 9 | Privacy | **Public pages show exact waitlist sizes to logged-out visitors** ("Current waitlist: 3 children") while the funder view suppresses <5 — the weakest audience gets the most precise number. | Band the public figure ("short / moderate / long waitlist" or "fewer than 5") on the directory and detail pages. |
| 10 | Privacy | **Daycares keep access to child records after withdrawal** — `daycare_knows_child()` matches entries of *any* status, so a family that left the list is still readable (P2 probe). | Decide the retention rule with stakeholders, then scope the predicate to `active`/`ineligible` entries + active enrolments, with a time-boxed exception if daycares need recent-departure records. |
| 11 | Privacy | **Broadcast recipient links outlive the consent flag** (P4 probe): after un-flagging, the funder loses the profile but keeps the recipient row. Defensible (point-in-time consent) but undocumented. | Cover it in the retention schedule (§7.4): recipient snapshots kept N months for accountability, then pruned. |
| 12 | Parent | **Declining an offer is one un-confirmed tap.** Leave-list and withdraw both confirm; decline — comparable in consequence — doesn't. | Add a confirm dialog stating what declining does ("the spot goes to the next family; you stay on all your waitlists"). |
| 13 | Parent | **No projections explainer.** §4.2.2's likelihood estimates are rightly deferred until data exists, but the dashboard says nothing. | Add a passive note: "Wait-time estimates will appear once the network has a year of history." Sets expectations, costs nothing. |
| 14 | Admin | **Audit log is view-only and capped at 100 rows** — no search, filter, pagination, or export for a log with 7-year retention. | Add actor/action/date filters and CSV export; paginate. |
| 15 | Daycare | Demo-only: no login exists for Sikusiilaq or Nanuq admins, so two of four daycares can't be operated in the demo. | Seed an admin account per daycare. |

## What passed cleanly

- **RLS walls (DB level):** funder, anon, and IT admin each read 0 rows from
  `children`, `waitlist_entries`, `enrolments`, `entry_notes`; anon sees only
  the daycare directory; parents can't touch each other's data or accept each
  other's offers; `expire_offers` denied to end users; audit log append-only
  even for IT admins.
- **Consent mechanics:** un-flagging instantly removes the parent's profile
  from funder view.
- **Role separation in UI:** staff get no offer/reorder/ineligible controls;
  staff notes invisible to parents; rank never rendered on any daycare surface.
- **Admin form editor round-trip:** a field added by the IT admin appears on
  the live parent application immediately, schema version bumped.
- **Input guards:** offer window floors at 1 day; fee floors at $0; manual
  reordering refuses to cross tier boundaries.
