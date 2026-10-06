# Design

## Context

See proposal.md for the motivation. Observed today:

- Widths: `.page-wrap`, `.header-inner`, `.footer-inner` and `.staff-strip>div` are capped at 960px (after an earlier 1080px declaration). The results page uses `.results-bar-inner`, `.results-main` and `.results-urgency` capped at 1800px. At 1440px that is a 960px header over a 1440px page.
- `ui-cohesion.css` pins the staff navigation with `width:960px; max-width:calc(100% - 48px)` to line it up by hand.
- Gutters: 20px side margins on content pages, 24px padding on results, 16px on small screens.
- Grids: `.detail-grid` (sidebar 310, 260, 300 or 270px), `.feedback-review-grid`, `.meeting-grid`, `.meeting-workspace`, `.directory-results-layout` and a resizable variant, each defined separately.
- 18 distinct `@media` widths. `styles.css` (50 KB), `ui-cohesion.css` (28 KB) and `ui-polish.css` override each other with `body .x`, `:has()` and `!important`.
- Page wrappers are mostly `.page-wrap` (24 uses) with `.finder-section`, `.results-shell`, `.imports-page` and `.customer-summary-page` as variations.

## Goals / Non-Goals

**Goals:**
- One frame and one gutter that every page shares, with the header and footer aligned to the page.
- Two reusable grids (main-and-side, list-and-map) and three breakpoints.
- Organised, layered CSS where a rule has one obvious home and later files no longer need to out-shout earlier ones.
- No visible change beyond alignment, spacing and width.

**Non-Goals:**
- Redesigning components (cards, forms, buttons), colours or typography.
- Changing behaviour, routes or data.
- Introducing a CSS framework or a build step for CSS.

## Decisions

**1. Cascade layers, adopted file by file.** Declare `@layer tokens, base, layout, components, pages;` once in `tokens.css`, imported first. A rule moves into the layer that owns it when its file is consolidated. Important constraint: CSS rules outside any layer always beat layered rules, and `!important` reverses layer order, so existing files are *not* wrapped blindly. New layered rules lose to legacy unlayered ones, so each step deletes the legacy rules it replaces in the same step, and a file is wrapped in its layer only once its conflicting rules are resolved. Third-party Leaflet CSS stays unlayered unless it can be imported into a vendor layer. Later layers win by order, not specificity, which removes the need for `body .x`, `:has()` hacks and `!important`. *Alternative:* BEM or utility classes; rejected as a much larger markup change. Layers are supported in all current browsers.

**2. Tokens.** In `tokens.css`: `--page-width: 960px` (reading), `--page-width-wide: 1440px`, `--gutter: 16px` rising to `24px` at the tablet breakpoint, a spacing scale (`--space-1` to `--space-8`), the side-column width `--side-width: 300px`, and the existing colour variables kept as they are. The widths are the only tunable numbers. 1800px goes, because a list and a map do not need to be wider than about 1440px, and a narrower wide variant keeps the header and content closer together on very large monitors.

**3. One frame, chosen by route.** `App` sets `data-width="reading" | "wide"` on the app root from the current route (wide for the home-with-results state and the meeting). A single `.container` rule (`width: min(100% - 2*var(--gutter), var(--page-width))`, switching to the wide token under `[data-width=wide]`) is used by the header, staff bar, staff navigation, page content and footer. The staff nav's fixed width hack is deleted. The search page switches to wide only once results are showing, so the home page stays a reading page. *Alternative:* a wide header everywhere; rejected so reading pages keep their comfortable measure.

**4. Two grids.**
- `.grid-main-side`: `minmax(0,1fr) var(--side-width)`, stacking on a phone, with an `--even` modifier (two equal columns that stack until the wide breakpoint). Used by the service detail and the feedback review; replaces `.detail-grid` and the two-column `.feedback-review-grid`. `.meeting-grid`, `.meeting-workspace` and `.principles` were found to be unused by any component and are deleted as dead CSS.
- `.grid-split`: list and map columns with the resizable divider (`--results-list-width`), becoming the list/map toggle below the tablet breakpoint. Replaces the layout rules of `.directory-results-layout` and `.resizable-results`. The divider owns its own visibility (hidden below the wide breakpoint) and the list/map toggle rules stay with the results page styles, because unlayered page rules would outrank layered ones.
Old class names are kept as aliases for one pass wherever a test or component references them, then removed from CSS once nothing needs them.

**5. Three breakpoints.** phone below 640px, tablet 640 to 1023px, wide from 1024px. Existing rules at 370, 380, 450, 500, 600, 650, 700, 750, 850, 860, 1020, 1023, 1100, 1140 and 1250 are each mapped to the nearest of the three and checked visually. The media-query values are written as constants in `tokens.css` comments, since custom properties cannot be used inside `@media`.

**6. Consolidation order.** Do it in passes, not one rewrite: tokens and layers (no visual change), the frame, the grids, then merge `ui-cohesion.css`, `ui-polish.css` and `results-layout.css` into the layers area by area (header and nav, results, detail, staff, meeting, summary, forms). Dead rules are found by checking each class against `src/**/*.tsx`; a rule with no matching class is deleted.

**7. Keep class hooks.** Class names used by components and by Playwright tests (`.service-card`, `.report-row`, `.review-card`, `.results-count`, `.about-facts`, `.search-options` and so on) stay. Only layout rules and the wrappers' container classes change.

**8. Verification by screenshots.** Before changing anything, capture every page at 390, 768 and 1440 wide (and 1920 for results) as a baseline. After each pass, capture again and compare by eye; every difference is either an intended alignment fix or is fixed. Baseline images are kept in the session scratchpad, not committed.

## Risks / Trade-offs

- [Visual regressions across many pages] → baseline screenshots, small passes, compare after each.
- [Changing the wide width from 1800px to 1440px changes the results page on large monitors] → intended; the value is one token and easy to adjust.
- [Cascade layers change which rule wins where specificity was doing the work] → move rules into layers area by area and compare screenshots, keep the original order within a layer, and delete a legacy rule in the same step as its replacement (unlayered rules always win).
- [Dead-rule detection by class name can miss dynamically built class names] → search for the class stem in source before deleting, and leave a rule alone if unsure.
- [Renamed or removed layout classes break test selectors] → keep every class a component or test references; aliases during the transition.
- [Third-party styles (Leaflet) inside the map] → keep them outside the layers or in the components layer, and check the map specifically.
- [No automated test run in this change] → screenshot comparison is the gate; Playwright can be run separately afterwards.

## Migration Plan

Each pass is a small commit that leaves the app looking the same, so any pass can be reverted alone. The old files are emptied as their rules move; once empty they are deleted and removed from `main.tsx`.
