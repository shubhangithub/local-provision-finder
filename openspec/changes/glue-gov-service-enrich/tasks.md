# Tasks

## 1. gov-hack client

- [x] 1.1 Add `server/gov-hack.ts`: reads `GOV_HACK_URL` and `GOV_HACK_API_TOKEN`, sends the bearer header, has request timeouts, and exposes submitJob, getJob, submitFollowup and getFollowup. Verify with unit tests against a fake HTTP server (auth header sent, 401 and unreachable mapped to clear errors, unconfigured reported).
- [x] 1.2 Document both variables in `.env.example` and `README.md`. Verify an unset variable disables the new routes with a `503` (test).

## 2. Enrichment storage and overlay

- [x] 2.1 Add `server/enrichment-store.ts` with `enrichment_runs` and `enrichment_overwrites`. Verify tests cover storing a result, one active run per service, and reading the latest successful run.
- [x] 2.2 Implement the topic-to-field map with typed validation (phone, email, plain text). Verify tests for each topic, an unparsable value staying a fact row, and a non-mapped key surfacing as a fact row only.
- [x] 2.3 Implement the read-time overlay (precedence: staff correction newer than enrichment, then enrichment, then catalogue) and apply it where `corrected()` is applied in `server/imports.ts` and `server/assistant-catalogue.ts`. Verify tests for overwrite, the original left intact, survival of a catalogue rebuild, and a newer staff correction winning.
- [x] 2.4 Implement revert (per field), the do-not-reapply-identical-value rule on refresh, and refresh passing the stored result as `previous`. Verify tests for revert, same value after revert not reapplied, and a different value applied.
- [x] 2.5 Outcome handling: `ambiguous`, `not_found` and error runs are stored and change no field, fact or search text. Verify with tests for each outcome.

## 3. Enrichment API and search

- [x] 3.1 Add `server/enrichment-api.ts` (registered in `vite.config.ts`): start enrichment (staff header, loopback), poll status (persists the result once, idempotent), revert, recently-enriched list, with retry context (URL or notes). Verify with API tests including a missing staff header returning 403 and no token in any response.
- [x] 3.2 Add enrichment fact text to the record's search text and `semanticChunks()`, and make `scripts/index-semantic.ts` read the overlay. Verify a test that a term found only in an enriched fact returns the service in keyword search, and that the fingerprint changes after enrichment.

## 4. Enrichment UI

- [x] 4.1 Staff service view: Enrich service profile button above Published contacts with states (disabled with reason when unconfigured, spinner while running, failed, unidentified), last-enriched date, gap count and Undo list. Verify with a Playwright test using a faked API.
- [x] 4.2 Enriched details merged into the full-width About this service rows (out-of-date marker, deduplicated, safe markdown). Verify with a Playwright test and an axe check.
- [x] 4.3 "Recently enriched" staff list with original and new values, quote, source and revert, linked from `StaffWorkspaceNav`. Verify with a Playwright test of revert updating the card.

## 5. Follow-up consent and storage

- [x] 5.1 Add `server/follow-ups-store.ts` (`follow_ups` table, retention clearing). Verify tests for storing consent separately, clearing on completion and expiry, and `/api/feedback` responses never containing a number.
- [x] 5.2 Extend `ServiceFeedback` and the feedback POST with optional phone and consent (a number without consent is rejected; both blank works). Verify tests for all three cases, and a Playwright test on the form with an axe check.

## 6. Follow-up trigger and results

- [x] 6.1 Add `server/follow-ups-api.ts`: start follow-up (staff header; sends `consent.attested` and the enriched `job_id` when present; one per report; shows denial reasons) and poll status. Verify with tests against the fake gov-hack including denied, answered and wrong-person calls.
- [x] 6.2 Map findings to pending `FeedbackStore` reports (closed or moved to availability closed, details to issues, quote to note, hedged labelled, nothing for no findings) without changing service fields. Verify tests for closed, price change, no findings and wrong person.
- [x] 6.3 `FeedbackReview`: "Follow-up scheduled in 1 week" label, Follow up now button, sandbox label, in-progress and result states, hidden for reports without consent. Verify with a Playwright test and an axe check.

## 7. Integration

- [x] 7.1 Add an end-to-end test over a fake gov-hack: enrich, see the overwrite, search by an enriched term, revert, then submit consenting feedback, follow up, and see the new pending report. Verify `npm test`, `npm run test:e2e` and `npm run build` pass.
- [x] 7.2 Run once against the deployed gov-hack with a real token for one service and one sandbox follow-up. Verify and record the observed result in the change notes.
