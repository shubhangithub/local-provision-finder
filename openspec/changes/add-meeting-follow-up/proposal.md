# Proposal

## Why

The follow-up call is meant for a person a staff member has just helped, but today it can only be asked for from the public feedback form, by someone who has already left a report about one service. That is the wrong place: the moment to ask is the end of a meeting, when the staff member and the customer are together, the customer has just chosen services, and staff can ask for contact details and consent. A meeting also ends with several chosen services, not one. And because a real follow-up is a week away, a hackathon demo needs a way to place the call on demand.

## What Changes

- When a staff meeting ends, the results screen offers **Ask for a follow-up call**: the customer's first name (optional), their phone number, and a confirmation that the customer agreed to a call. It can be skipped.
- The services the customer ticked during the meeting (the shortlist, up to five) become the services the call asks about.
- A **Follow-ups** page in the Staff menu lists every follow-up: the customer's first name, the services, a "scheduled in about a week" label and its status. Each has a **Follow up now** button that places the (sandbox) call straight away, and shows the outcome afterwards.
- What the customer says on the call (a service closed, moved, a price or time changed) still arrives as pending reports for staff to **Apply** or **Dismiss**. Nothing changes a service by itself.
- **BREAKING**: the follow-up option on the public feedback form (phone number and consent) and the follow-up status and button on **Service reports** rows are removed. The meeting is the only way to ask for a follow-up call.
- The stored follow-up record changes from "one feedback report, one service" to "one customer, several services".
- Calls stay sandbox-only. The phone number is deleted once the call completes or after 30 days, and is never shown in a list.

## Capabilities

### New Capabilities
- `meeting-follow-up`: asking for a customer's contact details at the end of a meeting, scheduling a follow-up call about the services they chose, triggering it manually, and turning what is said into pending reports.

### Modified Capabilities

None. There are no main specs yet. This change supersedes the feedback-form capture and report-row requirements of `service-follow-up` in the unarchived `glue-gov-service-enrich` change; those are removed here (see the design).

## Impact

- Server: `follow-ups-store.ts` (new record shape), `follow-ups-api.ts` (list, create, start, poll), `feedback-api.ts` (stop accepting follow-up details); the finding-to-report mapping is reused unchanged.
- UI: a follow-up prompt on the meeting results screen (`MeetingResults`/`MeetingDemo`), a new Follow-ups page and a Staff menu item, and removal of the consent fields in `ServiceFeedback` and the follow-up panel in `ReportRow` and `FeedbackReview`.
- Personal data: a customer's phone number and first name are stored. Same safeguards as before: staff-only, deleted on completion or after 30 days, never logged or listed.
- Tests: the follow-up tests for the feedback form and report rows are replaced.
