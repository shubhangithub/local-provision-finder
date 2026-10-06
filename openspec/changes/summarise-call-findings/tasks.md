# Tasks

## 1. Summary module

- [x] 1.1 Add `server/finding-summary.ts` with `summariseFinding` reusing `filterConfig()`: the prompt contract, a 10 second timeout, an in-memory cache, and validation (non-empty, within 200 characters, no first-person or "said" wording) returning `null` on any failure. Verify unit tests with a fake fetcher for a good rewrite, a first-person rewrite, an over-long rewrite, an HTTP error, a timeout and no configured key.

## 2. Use it when a call settles

- [x] 2.1 Make `reportFromFinding` produce the proposal field and the raw words separately, and add the rewritten value (with the call date added by code for capacity) only when the summary is available, otherwise no proposal. Verify unit tests for capacity, cost and opening times with and without a summary, and that the note and quote always keep the original words.
- [x] 2.2 Make `settle` and `check` asynchronous: summarise before `finish()`, then submit reports once. Verify an API test over the fake call service where the model is faked, covering a rewritten proposal, a failing model (report created, no proposal) and two settles of the same call creating one set of reports.
- [x] 2.3 Confirm the request sent to the model contains only the service name and the finding's words. Verify with a test that the phone number and first name never appear in it.

## 3. Check it live

- [ ] 3.1 Place one call, say something first-person about waiting times, and confirm the report shows a neutral proposed value beside the exact quote. Note the result in the design.
- [x] 3.2 Update the README follow-up section with one line on the rewrite and its fallback.
