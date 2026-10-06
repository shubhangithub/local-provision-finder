# Design

## Context

See proposal.md for motivation. Observed in finder today:

- `data/services.sqlite` `catalogue_services` is rebuilt wholesale by `scripts/clean-data.ts` (`DELETE` then insert), so anything written into `record_json` is lost on the next rebuild.
- Edits already reach users as read-time overlays: `FeedbackStore.corrected()` is applied in `server/imports.ts` and `server/assistant-catalogue.ts`, backed by its own SQLite file.
- APIs are Vite middleware plugins (`server/*-api.ts`), loopback-only, with staff mode as a demo header (`x-staff-demo`), not authentication.
- Semantic search reads `data/semantic-index.sqlite`, with chunks from `semanticChunks(record)` and a per-record fingerprint that re-embeds on change.
- gov-hack: `POST /jobs`, `GET /jobs/:id` (poll), `POST /followups`, `GET /followups/:id`; every route except `/health` needs `Authorization: Bearer <API_TOKEN>`.

## Goals / Non-Goals

**Goals:**
- Enrichment that survives catalogue rebuilds, is fully reversible, and shows its evidence.
- Follow-up outcomes that flow through the existing report review.
- gov-hack credentials never reach the browser.

**Non-Goals:**
- Real (non-sandbox) calls or emails, an automatic one-week scheduler, batch enrichment, real authentication, or changes to gov-hack itself.

## Decisions

**1. Overlay, not in-place edit.** Enrichment lives in `data/enrichment.sqlite` and is applied at read time, after the catalogue and before staff corrections. This survives rebuilds and makes revert a row update. *Alternative:* patch `record_json`; rejected because rebuilds erase it and the original would be lost.

**2. Precedence.** A staff-verified correction newer than the overwrite beats enrichment, which beats the catalogue. Staff intent always wins over an automated overwrite.

**3. Tables.** `enrichment_runs(service_id, job_id, outcome, result_json, started_at, finished_at, error)` keeps each run, with the latest successful one in force. `enrichment_overwrites(id, service_id, field, original, value, source_url, quote, applied_at, reverted_at)`. Facts are read from the latest run's `result_json`, not copied.

**4. Fact-to-field mapping.** gov-hack tags facts with a checklist `topic`. A fixed map sends topics to fields: cost to `cost`, session times to `openingTimes`, eligibility to `eligibilitySummary`, accessibility to `accessibility`, contact details to `publicPhone`/`publicEmail`, location to `address`. A fact is applied to a field only if its value validates as that field's type; otherwise it stays a fact row. Every fact, mapped or not, also appears as a row (humanised key, value, source, `valid_to`), so arbitrary agent-chosen keys are supported. *Alternative:* LLM mapping; rejected for cost and unverifiable output.

**5. Reverted values stay reverted.** A revert stores `reverted_at`. On refresh, an identical value for that field is not reapplied; a different value is.

**6. Search.** Fact text is appended to the record's search text at overlay time (keyword search). `semanticChunks()` also takes enrichment chunks and fact text, so the fingerprint changes and the existing re-embed path picks it up; `scripts/index-semantic.ts` reads the overlay too. Only the latest successful run counts. `ambiguous`, `not_found` and error runs contribute nothing.

**7. Server-side gov-hack client.** One small module (`GOV_HACK_URL`, `GOV_HACK_API_TOKEN`) with timeouts, used only by new middleware routes (`/api/enrichment/*`, `/api/follow-ups/*`). Enrich is asynchronous: the route returns a run id at once, and the browser polls finder's status route, which proxies `GET /jobs/:id` and persists the result on first completion (idempotent). Unconfigured means the routes return a clear `503` and the UI disables its controls.

**8. Context sent.** The job's `context` carries the service's postcode, address, website and provider, plus any staff-supplied URL or notes on retry. It never contains a person's data.

**9. Follow-up consent storage.** `data/follow-ups.sqlite` holds `follow_ups(feedback_id, phone, consented_at, status, followup_id, requested_at, finished_at)`, separate from `feedback.sqlite`. `FeedbackStore` and `/api/feedback` never read it. A number needs consent. The number is cleared when the follow-up finishes or after a retention period (default 30 days, enforced on access).

**10. Follow-up trigger and result.** "Follow-up scheduled in 1 week" is derived text, not a timer. Follow up now calls gov-hack `POST /followups` with `consent.attested: true` and the report's service (with the latest enrichment `job_id`, when any), stores its id, and polls. On completion each service finding becomes a pending `FeedbackStore` report: `operating` closed or moved maps to `availability: 'closed'`, details map to `issues` (price to cost, times to openingTimes, phone, email and address likewise), and the quote goes into `note`. Outcomes `wrong_person`, `declined`, `no_answer` or no findings create no report. Hedged findings are included and labelled hedged in the note.

**11. Merged display.** The About section is the single place for details. Facts consumed by an applied (or already identical) standard field are removed from the extra-facts list on the server in the overlay, so the page never has to guess. Enriched values render through `react-markdown` with raw HTML, images and non-http links disabled. The admin control lives in the side column above Published contacts and carries no detail of its own: button, spinner, last-enriched date, gap count, changes with Undo. Website and notes retry inputs were dropped for simplicity (the API still accepts them).

**12. Public vs staff.** The feedback form is public, but the follow-up fields are write-only there. The follow-up state and Follow up now sit behind the staff header, matching the availability and review routes.

## Risks / Trade-offs

- [Unreviewed content overwrites a published field] → original and evidence kept, source and quote recorded and shown on Recently enriched, one-click revert, staff corrections win.
- [Wrong service researched, wrong facts applied] → only `found` or facts-bearing `partial` results apply; `ambiguous` and `not_found` change nothing; quote and source are shown.
- [Bad value in a structured field, such as a malformed phone] → typed validation per field before overwrite, else a fact row only.
- [New personal data in finder] → separate table, staff-only, numbers never logged, deleted after follow-up or retention.
- [gov-hack job cost and duration, about a minute and cents each] → staff-triggered per service, one active run per service.
- [gov-hack `API_TOKEN` support is uncommitted in that repo] → documented dependency; Enrich fails clearly on a 401.
- [An enriched address keeps the old map coordinates, unlike a staff address correction, which clears them] → the overwrite is shown and revertible; coordinates are re-derived only when staff correct the address.
- [Staff mode is a demo toggle, not authentication] → existing limitation, restated in the README.
- [Run results are large] → stored once per run; list views read summaries only.

## Migration Plan

New SQLite files are created on first use; nothing existing is altered. Rollback: remove the overlay from the read path and ignore the new files. Enrichment and follow-up UI stay disabled until `GOV_HACK_URL` and `GOV_HACK_API_TOKEN` are set.

## Live verification (task 7.2, 2026-10-06)

Run against the deployed gov-hack with a real token, on Best Start Family Hub Elmhurst (Aylesbury).

- **Enrichment:** completed in about a minute with outcome `found`: 23 facts, 6 fields overwritten (opening times, how to book, accessibility, cost, eligibility, address), each with its source URL and quote, and 2 gaps (accessibility open, session times needing a person).
- **Follow-up:** accepted (`202`) and queued by gov-hack. Its policy gate allowed the request, then deferred the call to 09:00 UK time because it was placed outside calling hours. The call itself was not observed, so the result-to-report path was verified only against the fake service.
- **Finding:** gov-hack reports gate decisions as `result: allow | deny | defer`, not a boolean; refusal reasons are now read from `deny`. Fixed and covered by a test.
- **Observation:** enrichment replaced a fuller existing accessibility list ("Accessible toilet facilities; Wheelchair…") with a shorter, different statement about parking and entry. Revert handles it, but a future change could keep the richer value or append instead of replacing.
