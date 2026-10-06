# Tasks

## 1. Baseline

- [x] 1.1 Capture screenshots of every page (home, results, service detail, saved, suggest, staff: reports, recently enriched, new listings, add provision, directory records; meeting and its summary) at 390, 768 and 1440 px wide, plus 1920 for results, into the session scratchpad. Verify the set is complete against a written page list.
- [x] 1.2 Inventory the CSS: for each file list the container, grid and breakpoint rules, and record which classes the tests reference. Verify with a short written inventory kept in the change notes.

## 2. Tokens and layers

- [x] 2.1 Add `src/styles/tokens.css` with the layer order and the width, gutter, spacing and side-width tokens, and import it first in `src/main.tsx`. Existing files stay unlayered for now, because unlayered rules beat layered ones. Verify with a screenshot comparison that every page is pixel-identical to the baseline.
- [x] 2.2 Document the tokens and layer order in `docs/layout.md`. Verify the doc lists every token with its value.

## 3. Frame

- [x] 3.1 Add the shared `.container` and the width variants, set `data-width` from the route in `App.tsx`, and move the header, staff bar, staff navigation, page content and footer onto it, deleting the old width, margin and fixed-width rules. Verify at 1440 that the header, content and footer share edges on a reading page and on the search results.
- [x] 3.2 Replace the per-page side margins and the results page's own 1800px and 24px rules with the shared gutter. Verify every page's content is inset by the same gutter at 390 and 1440.
- [x] 3.3 Compare against the baseline for all pages and fix or accept each difference. Verify no page scrolls sideways at 320px.

## 4. Grids

- [x] 4.1 Add `.grid-main-side` and move the service detail and the feedback review onto it (the summary and meeting grids turned out to be dead CSS and are deleted in group 6), removing the duplicate sidebar widths. Verify the service detail page keeps a fixed side column on desktop and stacks on phone.
- [x] 4.2 Add `.grid-split` for list and map and move the results onto it (the live meeting is a single column, so it only takes the wide frame), and keep the resizable divider and the phone list/map toggle. Verify the divider drags and responds to the keyboard in the browser, and the toggle works at 390.
- [x] 4.3 Compare against the baseline and fix or accept each difference.

## 5. Breakpoints

- [x] 5.1 Map every existing breakpoint to the three defined widths, area by area, adjusting rules that relied on an in-between value. Verify by resizing across 320 to 1920 on the home page, results, detail and meeting that layout changes only at 640 and 1024.

## 6. Consolidate

- [ ] 6.1 Fold `ui-polish.css` and `results-layout.css` into the layers by area, deleting the `body .x` overrides and `!important` they needed. Verify screenshots match for the pages each file touched.
- [ ] 6.2 Fold `ui-cohesion.css` into the layers area by area (header and navigation, results, detail, staff, forms), deleting duplicates and dead rules after checking class usage in the source. Verify screenshots match after each area.
- [ ] 6.3 Wrap each remaining component stylesheet (`agent.css`, `meeting.css`, `customer-summary.css` and the rest) in its layer now that no unlayered rule can outrank the layout, decide whether Leaflet's CSS can go in a vendor layer, then remove emptied files and their imports. Verify the app builds and a full screenshot comparison still matches.

## 7. Final check

- [x] 7.1 Capture the full screenshot set again, compare each page against the baseline, and list every remaining difference with its reason. Verify each is an intended alignment, width or spacing change.
- [x] 7.2 Update the README layout notes and `docs/layout.md` with the final tokens, grids and breakpoints. Verify the docs match the code.
