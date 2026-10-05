## 1. Region state

- [x] 1.1 Add `src/lib/region.ts` with `useRegion()` (get/set/clear, localStorage with try/catch, `region-changed` event) and unit tests for parse/invalid data
- [x] 1.2 Build the API param helper (`area`/`lat`/`lng`/`bounds`) once and reuse it in search, autocomplete and assistant calls

## 2. Header dropdown

- [x] 2.1 Extract the picker body (area select, town/postcode form, current location, map area) from `LocationSearch.tsx` into `src/components/RegionMenu.tsx`
- [x] 2.2 Add the cog button + popover to the header in `src/App.tsx` showing the current region, with aria-expanded, Escape/outside-click close and focus return
- [x] 2.3 Add a "clear region" control and error display for declined geolocation
- [x] 2.4 Style the dropdown (desktop popover, full-width sheet under 640px)

## 3. Wire consumers

- [x] 3.1 Update `LocationSearch.tsx` to use `useRegion()`; remove the trigger, `<dialog>` and "Change location"; run searches with no region and reset to page 1 on region change
- [x] 3.1a Remove every in-search "Choose location" path from `LocationSearch.tsx`: the `location-trigger` button, the `<dialog>`/`location-title` "Choose location" heading, the submit-opens-picker behaviour when no place is set, the empty-state "Change location" button, and the picker-only state (`pickerOpen`, `pickerArea`, `pickerBounds`, `pickerServices`, `draft`, `locationError`, `locating`, `geoRequest`)
- [x] 3.1b Replace "Choose an area…"/"enter a postcode" error and empty-state copy with wording that points to the header region settings
- [x] 3.2 Show the active region (or "all areas") in the results heading
- [x] 3.3 Remove area inference from `DirectoryAgent.tsx`; use the header region and mention where to change it
- [x] 3.4 Confirm `PublicAssistant` receives the region-scoped `search` params

## 3b. Home screen redesign

- [x] 3b.1 Restructure the home form into a single search row (field + submit) with the region indicator and "Change" link beneath, and the urgency notice directly after
- [x] 3b.2 Move the staff "Start meeting" entry below the search area as a secondary action
- [x] 3b.3 Consolidate the duplicated hero/search-form CSS between `styles.css` and `ui-cohesion.css`; add responsive stacking and 44px touch targets at 375px
- [x] 3b.4 Check the result and detail states still collapse the hero and widen as before
- [x] 3b.5 Verify in the browser at 1280x720 and 375x812 (above the fold, no horizontal scroll, keyboard order)

## 3c. Results page redesign

- [x] 3c.1 Add the full-bleed results shell with sticky compact search bar (query, submit, region line) and an explicit `data-state` replacing the `:has()` hero/width rules
- [x] 3c.2 Make the map column sticky and full height (CSS variables for header and bar heights, 320px minimum) in `ResizableResults`; keep the keyboard-accessible divider
- [x] 3c.3 Create `ResultsToolbar` combining title, count, unknown-location option, map-area reset and keyword-fallback note; remove the old heading and `nearby-options` blocks
- [x] 3c.4 Add a compact collapsible mode to `PublicAssistant` (summary visible, details in a closed-by-default disclosure) and use it above the list
- [x] 3c.5 Keep card/marker highlighting and scroll-into-view working in the new layout
- [x] 3c.6 Below 1024px add the fixed bottom list/map toggle (hidden on desktop) and full-height mobile map; below 640px height stack the layout
- [x] 3c.7 Ensure loading, empty and error states render inside the list column with the map visible
- [x] 3c.8 Remove superseded results CSS (`location-results*`, duplicated `directory-results-*`, `view-map` ratios) from `styles.css` and `ui-cohesion.css`
- [x] 3c.9 Verify at 1280x720, 1920x1080, 768x1024 and 375x812 (first card above the fold, map stays in view, no horizontal scroll, keyboard order)

## 4. Meetings

- [x] 4.1 Remove the "Find support in" select and `area` prop from `MeetingDemo.tsx`; use the header region (Bristol fallback) for `live.open` and the meeting assistant search, and show the area in use
- [x] 4.2 Remove `area` from `AgentContext` if no longer needed

## 5. Legacy demo and dead code removal

- [x] 5.1 Remove the `#/demo` route (redirect to `#/`), postcode search form, `SearchOptions`, `demoSearch`, `parsePostcode` handling and URL `postcode/radius/remote` parsing from `App.tsx`
- [x] 5.2 Remove `findServices`/`parsePostcode`/`defaultQuery` from `src/lib/search.ts` and the postcode lookup from `src/data/catalogue.ts`; grep usages and keep anything still used by staff review
- [x] 5.3 Prune unused fields in `src/types.ts` (`postcode`, `radius`, `includeRemote`, `postcodePrefixes`) and the "Area listed" detail fact if now unreachable
- [x] 5.4 Replace area-name regexes with `directoryAreas` lookup; remove unused location/picker CSS in `styles.css` and `ui-cohesion.css`

## 6. Tests

- [x] 6.1 Update `tests/map.spec.ts` and `tests/location.spec.ts` to use the header dropdown; delete or port the `#/demo` cases in `app.spec.ts`/`accessibility.spec.ts` and `src/lib/search.test.ts`
- [x] 6.2 Add e2e tests: open/close dropdown, set + persist across reload, change region re-runs search, search with no region, agent ignores message-area, meeting uses header region, `#/demo` redirects
- [x] 6.2a Add e2e tests for the results layout: list left/map right at 1280px, first card visible, sticky bar stays, overview collapsed by default, bottom toggle at 375px, marker selection scrolls its card
- [x] 6.3 Run lint, unit and e2e suites and manually check keyboard and mobile layout
