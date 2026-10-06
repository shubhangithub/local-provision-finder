# Proposal

## Why

Page widths and grids are inconsistent. At a 1440px viewport the brand and nav sit in a centred 960px column on every page, but on search results the bar, list and map run edge to edge (an 1800px container), so the header looks small and misaligned. Underneath, the layout is a stack of overrides: `.page-wrap` is declared as 1080px and then 960px, the header's spacing is redefined about six times, gutters are 20px, 24px or 16px depending on the page, the detail page's sidebar is 310, 260, 300 and 270px in different places, there are 18 different breakpoints, and `ui-cohesion.css` and `ui-polish.css` override `styles.css` with `body .x`, `:has()` and `!important`. Each new page has had to fight the cascade.

## What Changes

- Introduce one frame: a shared container with two width variants (**reading** and **wide**) and one gutter. The header, staff bar, staff navigation, page content and footer all take the width of the page they sit on, so they line up.
- Replace the separate two-column layouts (service detail, feedback review, meeting, summary) with one main-and-side grid, and the list-and-map layouts (results, meeting workspace) with one split grid that keeps the resizable divider.
- Define spacing, widths and gutters as design tokens, and reduce breakpoints from 18 to three.
- Consolidate `styles.css`, `ui-cohesion.css`, `ui-polish.css` and `results-layout.css` into organised cascade layers (tokens, base, layout, components, pages), delete dead and duplicate rules, and remove the `!important` and `body .x` overrides.
- Keep the class names that tests and components already use (for example `.service-card`, `.report-row`, `.review-card`), so no behaviour or markup contract changes.
- No data, API or feature changes. This is a visual and structural change only; pages are expected to look the same apart from the alignment fixes.

## Capabilities

### New Capabilities
- `page-layout`: how every page is framed (width variants, gutters, header, footer and staff navigation alignment), how multi-column areas behave, and how the layout responds to screen size.

### Modified Capabilities

None. No existing main specs.

## Impact

- CSS: `src/styles.css`, `src/styles/ui-cohesion.css`, `ui-polish.css`, `results-layout.css`, `customer-summary.css`, `meeting.css`, `resizable-results.css`, `region.css` and others are reorganised. New `tokens.css`. `src/main.tsx` import order changes.
- Markup: small. `App.tsx` marks the page width variant by route, and a few page wrappers adopt the shared grid classes. No component logic changes.
- Verification is by before and after screenshots at desktop, tablet and phone widths. Playwright selectors are kept compatible but no test run is part of this change.
- Risk: visual regressions across pages. Mitigated by a screenshot baseline and per-area passes.
