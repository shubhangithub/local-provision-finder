# Proposal

## Why

A follow-up call turns what a person says into a pending report with a proposed change. The proposed value is currently the caller's own words. For Turning Point it was stored as "They said they were really busy. I don't think they're gonna be able to see me for the next couple of weeks. (reported on a call, 2026-10-06)", and that is what the service page now shows. First-person speech, "They said" and "me" do not belong on a public service page, and a staff member applying the change with one click should not have to rewrite it afterwards.

## What Changes

- When a finished call produces a proposed change, a language model rewrites the person's words into one short, neutral statement about the service, for example "Busy: about a 2-week wait (reported 6 Oct 2026)".
- The rewrite is used only as the proposed value. The person's exact quote stays unchanged as the evidence in the report, so staff always see what was actually said.
- The rewrite is checked before use. If the model is not configured, fails, times out, or returns something that is not a short third-person statement, the report is still created but without a one-click proposal, so staff review and word it themselves. Nothing is applied automatically.
- No new screens or settings. It reuses the existing Azure OpenAI or OpenAI configuration that the live meeting filter uses.

## Capabilities

### New Capabilities
- `call-finding-summary`: turning a person's spoken finding about a service into a neutral, reviewable statement for a proposed change, with a safe fallback.

### Modified Capabilities

None. There are no main specs yet; this refines the finding-to-report behaviour from `add-meeting-follow-up`.

## Impact

- Server: a new summary module beside `relevance-filter.ts`; `follow-up-findings.ts` (proposal values) and `follow-ups-api.ts` (settling a call becomes asynchronous).
- Data sent to the model: the finding's quote and detail text for one service, and the service name. Never the phone number or the person's name.
- Cost: one small request per proposed change, only when a call finishes.
