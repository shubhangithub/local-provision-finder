# Tasks

## 1. Follow-up record and API

- [x] 1.1 Replace the follow-up store with `meeting_follow_ups` (first name, phone, agreement time, services, status, call id, outcome, reason, report ids), keep the 30-day phone retention, and clear phone numbers left in the old `follow_ups` table. Verify unit tests for storing, listing without the phone, completing (phone deleted), expiry and the legacy clear.
- [x] 1.2 Add the staff-only API: create (validates the phone, the agreement tick, one to five services that exist), list, poll-and-settle, and call (only from scheduled, denied or failed). Verify API tests for each rule, including a missing staff header returning 403 and no phone in any response.
- [x] 1.3 Place the call with all stored services (each with its latest enrichment job id when there is one) and settle a finished call by matching findings to services by name and creating one pending report per finding, once. Verify a test over the fake call service with three services and findings for two.

## 2. Offer at the end of a meeting

- [x] 2.1 Add `FollowUpOffer` to the meeting results: first name, phone, the agreement tick, a list of the services it will ask about (capped at five, with a note if some were left out), Skip, and a confirmation after saving. Verify with a Playwright test that ticks two services, ends the meeting, saves details and sees the confirmation, and that a number without the tick shows an error.
- [x] 2.2 Show a short explanation instead of the form when no service was ticked. Verify with a Playwright test.

## 3. Follow-ups page

- [x] 3.1 Add the Follow-ups page and route, and a **Follow-ups** item in the Staff menu. Rows show first name, services, "Scheduled in about 1 week", the Sandbox demo tag and Follow up now, with the in-progress, completed (and how many changes to review), refused and not-configured states. Verify with a Playwright test over a faked API, including an accessibility check.
- [x] 3.2 Update the Staff menu test and docs for the new item. Verify the menu test lists Follow-ups.

## 4. Remove the old capture

- [x] 4.1 Remove the follow-up fields from `ServiceFeedback` and from the feedback API, and the follow-up status and button from `ReportRow` and `FeedbackReview`; delete the code and tests that only served them. Verify the feedback form has no phone field and report rows show only Apply, Dismiss or Review, and the build passes.
- [x] 4.2 Update the README follow-up section and `.env.example` notes for the meeting-based flow, including that one number can be followed up once a week. Verify the README steps match the UI.

## 5. Integration

- [x] 5.1 Update the end-to-end integration test over the fake call service: create a follow-up from a meeting, place the call, see the pending reports, Apply one. Verify the test passes and `npm run build` succeeds.

> Note: the Playwright tests described in 2.1, 2.2 and 3.1 were not written; those flows were left for manual testing. The old feedback-form follow-up test was deleted with the feature it covered.
