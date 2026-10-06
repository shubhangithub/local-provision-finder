# Design

## Context

See proposal.md for motivation. Observed today:

- A meeting ends in `MeetingDemo` (phase `finished`), which shows `MeetingResults`: the summary, and a next-steps report of the services the customer ticked (`useMeetingShortlist()`, each a `MeetingChoice` with the service and the topic that found it). The next-steps report already has a "Send a copy" panel that takes an email or mobile number but sends nothing.
- Follow-ups were built around one feedback report: `follow_ups(feedback_id PK, service_id, service_name, phone, …)`, created by `/api/feedback` when a report carries consent, started with `POST /api/follow-ups {feedbackId}`, shown by `FollowUpPanel` inside report rows.
- The call service (gov-hack) already accepts up to five services per call, each with an optional `job_id`, and returns one finding per service. The mapping from a finding to a pending report with a proposed change, and the Apply and Dismiss row, already exist and do not depend on where the follow-up came from.
- The phone is deleted when a follow-up completes and after 30 days; the call is sandbox-only (the deployment calls its own test phone).

## Goals / Non-Goals

**Goals:**
- Ask for contact details at the one moment it makes sense, the end of a meeting, and tie the call to the services the customer chose.
- A staff page where follow-ups can be seen and the call placed on demand.
- Reuse the finding-to-report path unchanged.

**Non-Goals:**
- A real scheduler that places calls after a week, real (non-sandbox) calls, or email follow-up.
- Saving the meeting itself, its transcript or its summary. Only the contact details and the chosen services are stored.
- Letting the customer enter their own details. Staff enter them, with the customer present.

## Decisions

**1. A new record, not a changed one.** `meeting_follow_ups(id, person_name, phone, consented_at, services_json, status, followup_id, requested_at, finished_at, outcome, reason, report_ids)` in `data/follow-ups.sqlite`, with `services_json` holding `[{id, name}]`. The old `follow_ups` table (one report, one service) is no longer used; a one-off step clears any phone numbers left in it. *Alternative:* add columns to the old table; rejected because its key and shape are per report.

**2. Services come from the shortlist at the moment of submitting.** The offer reads the ticked services, caps them at five (the call limit) and tells staff if some were left out. The server re-checks each id against the catalogue and stores the name, so a stale id is rejected. The latest enrichment `job_id` for each service is looked up when the call is placed, as before, so enrichment done between the meeting and the call is used.

**3. Consent is staff's attestation.** The form requires a tick, "The customer agreed to a follow-up call", and the server rejects a number without it. It is passed to the call service as `consent.attested`, which is what that service expects. The customer's first name is optional and used only to ask for them by name.

**4. API shape (all staff-only, same guards as the other staff routes).**
- `POST /api/follow-ups` create: `{firstName?, phone, agreed, services:[{id}]}` → the follow-up without the phone.
- `GET /api/follow-ups` list; `GET /api/follow-ups?id=…` poll one, which settles a finished call once.
- `POST /api/follow-ups/call` `{id}` place the call, only from `scheduled`, `denied` or `failed`.
The "scheduled in about a week" text is a label derived in the UI; no timer exists.

**5. Settling a call reuses the existing code.** When the call service reports a finished call, each finding is matched to a stored service by name, turned into a pending report with `reportFromFinding` and the `proposed` change, and the follow-up is marked completed once, with its phone deleted. Findings about a service that matches none of the stored names are ignored.

**6. UI.** `FollowUpOffer` (below the next-steps report) is a short form that collapses to a confirmation. The Follow-ups page is a list of rows: first name, services, "Scheduled in about 1 week" or the outcome, a Sandbox demo tag, **Follow up now** and a link to the resulting reports. The Staff menu gets a **Follow-ups** item in its second group, with no count. `FollowUpPanel` is reworked into the row on the new page and removed from `ReportRow` and `FeedbackReview`.

**7. Removing the old capture.** The consent fields come out of `ServiceFeedback`, `feedback-api.ts` stops reading `followUp`, and the follow-up status and button come out of `ReportRow` and `FeedbackReview`. The public feedback endpoint then ignores an unexpected `followUp` field rather than storing it.

## Risks / Trade-offs

- [A phone number is personal data] → staff-only, never listed or logged, deleted on completion or after 30 days, and the legacy table is cleared.
- [The offer is only available in the live session; reloading the page at the end of a meeting loses it] → accepted for the demo; the meeting itself is not saved.
- [Staff attest consent they did not obtain] → the wording on the tick states what is being agreed, and the call is sandbox-only.
- [The call service allows one follow-up per number per week, so a demo number cannot be reused] → the refusal reason is shown on the row, and the README notes using a different number.
- [A service ticked in the meeting is later removed from the catalogue] → the follow-up still lists it by stored name and a finding for it cannot create a report, which is ignored.
- [Breaking change: people can no longer ask for a call from the feedback form] → intended, per the proposal.

## Migration Plan

Create the new table on first use, clear phone numbers from the old one, ship the removal of the old capture in the same change so there is only one path. Rollback is reverting the change; no data needs restoring because follow-ups are demo data.
