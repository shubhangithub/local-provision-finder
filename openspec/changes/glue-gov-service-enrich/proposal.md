# Proposal

## Why

Directory records are thin and go stale. The sibling `gov-service-enrich` service (deployed on Azure, bearer-token protected) researches a service on the open web, returns sourced facts and search chunks, finds gaps, and can phone a person a week after they found a service to ask how it went. Finder has none of this wired in, so staff must check every service by hand and learn about closures only when someone reports them.

## What Changes

- Admins get an **Enrich service profile** button at the top of a service's side column, with a spinner while it runs. Finder submits the service to gov-hack, polls the job, and stores the result.
- Facts for the checklist topics (cost, session times, eligibility, accessibility, contact details, location) automatically overwrite the matching service fields. The original value, source URL, quote and date are kept, and staff can revert each overwrite.
- Enriched details are merged into the **About this service** box, one column at full width. Facts that repeat a standard field are not shown twice, every other fact becomes a labelled row, and enriched text renders as safe markdown. Fact text is also added to the service's searchable text and the semantic index.
- The admin block shows when the service was last enriched, a count of gaps gov-hack could not confirm, and each overwrite with an Undo button. Staff also get a "Recently enriched" list.
- An `ambiguous` or `not_found` outcome changes nothing; staff are told and can refresh.
- The public feedback form gains an optional phone number and a consent tick, stored separately from the report.
- On **Service reports**, staff see "Follow-up scheduled in 1 week" (a label only) and a **Follow up now** button that asks gov-hack to place a sandbox call. Its findings (closed, moved, changed price or times) arrive as new pending service reports for normal staff review, and are never applied automatically.
- Finder talks to gov-hack only from the server, using `GOV_HACK_URL` and `GOV_HACK_API_TOKEN`. When either is missing, the new buttons are disabled with a stated reason.

**Policy change:** enrichment is the first path by which unreviewed content changes a published field. The kept original, the recorded source and quote, and undo are the safeguards.

## Capabilities

### New Capabilities
- `service-enrichment`: staff-triggered web enrichment of a service, how its facts, chunks and gaps appear in the directory, and how overwrites are surfaced and reverted.
- `service-follow-up`: optional follow-up consent on feedback, staff-triggered follow-up calls, and how call findings become pending reports.

### Modified Capabilities

None. There are no main specs yet (`openspec list --specs` is empty), so these are new.

## Impact

- New server modules and `/api` routes in the Vite middleware style (`server/*-api.ts`), a gov-hack client, and new SQLite files `data/enrichment.sqlite` and `data/follow-ups.sqlite`.
- Read-time overlay applied wherever `feedback.corrected()` is applied (`server/imports.ts`, `server/assistant-catalogue.ts`). Search text and `scripts/index-semantic.ts` include enrichment.
- UI: `ServiceCard`, the staff service view, `ServiceFeedback`, `FeedbackReview`, `StaffWorkspaceNav`.
- Environment: `GOV_HACK_URL`, `GOV_HACK_API_TOKEN`, documented in `.env.example` and `README.md`.
- Depends on the gov-hack `API_TOKEN` support, which is currently uncommitted in that repository.
- New personal data (a phone number) is held in finder. Calls remain sandbox-only; real calls are out of scope.
