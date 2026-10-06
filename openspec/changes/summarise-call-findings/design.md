# Design

## Context

Observed today: `reportFromFinding` in `server/follow-up-findings.ts` builds a proposal from the finding's own text (`details[].said`, or the call's `feedback` for capacity), clipped and, for capacity, suffixed with the call date. `settle()` in `server/follow-ups-api.ts` calls it synchronously, finishes the follow-up once, then submits reports with the proposal. Applying a proposal writes its value as a correction, so whatever text is proposed is what the service page shows. The live meeting filter in `server/relevance-filter.ts` already chooses Azure OpenAI or OpenAI from the environment (`filterConfig()`) and calls chat completions with a timeout, caching and a safe failure path.

## Goals / Non-Goals

**Goals:**
- Proposed values that can be applied with one click and read well on a service page.
- The original words always available as evidence.
- A safe fallback that never blocks or loses a report.

**Non-Goals:**
- Rewriting the report note or the quote, auto-applying anything, or changing which findings become reports.
- A new provider, model setting or UI.

## Decisions

**1. A separate small module, same provider config.** `server/finding-summary.ts` exports `summariseFinding(input, config, fetcher)` returning a string or `null`, reusing `filterConfig()` so no new environment variables are needed. *Alternative:* a new config block; rejected as unnecessary.

**2. Rewrite only the proposal value.** The report note and `quote` keep the person's words. This keeps evidence honest and limits the model's influence to one reviewable string.

**3. Prompt contract.** The system prompt asks for one sentence under about 120 characters, third person, about the named service, no "they said", no "I", "me" or "my", no names, keeping numbers and units exactly, and no invented facts. It receives the field (capacity, cost, times and so on), the service name and the person's words. Capacity values keep the existing date suffix, added by code, not by the model, so the date is always correct.

**4. Validation before use.** Reject empty output, output over 200 characters, first-person pronouns (`I`, `me`, `my`, `we`, `our`), and phrases like "said" or "told". Any rejection returns `null`.

**5. Fallback is no one-click proposal.** When the rewrite is `null`, the report is still created, with the original note, but `proposal` is omitted. Staff then use the existing full review and write the value. *Alternative:* fall back to the raw words as the proposed value; rejected because that is the bug being fixed.

**6. Order of work when settling.** Summarise first, then `finish()` (the single winner of the status change), then submit reports. A rare duplicate model call from two concurrent settlers is harmless, whereas summarising after `finish()` would let a poll see a completed call with no reports yet. `settle` and `check` become asynchronous; the background sweep and the page's poll already await them.

**7. Timeout and cache.** A 10 second timeout like the filter, and an in-memory cache keyed by field, service and text so a retried settle does not pay twice.

## Risks / Trade-offs

- [The model distorts or invents a detail] → only a short, validated rewrite is used, the exact quote sits beside it, and nothing applies without a staff click.
- [A slow model delays settling] → 10 second timeout, then the fallback; the sweep runs every 10 seconds anyway.
- [Personal data leaves the system] → only the service name and the finding's words are sent; phone and name never are. The quote itself could contain a name, which is unchanged from how the same text is already stored.
- [Hedged findings] → they already skip one-click Apply, so a rewrite there only improves the text staff start from.

## Migration Plan

No data migration. Existing applied corrections keep their text; staff can correct them by hand. Rollback is removing the summary call, which restores today's behaviour.

## Open Questions

None. The Turning Point correction already applied can be re-worded by staff.
