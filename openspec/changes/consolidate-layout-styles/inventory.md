# Layout inventory (task 1.2)

Generated before any change, from the CSS as it stood on `main` after PR #5.

## Files and size

- `src/styles.css` 49 KB
- `src/styles/about-facts.css` 1 KB
- `src/styles/agent.css` 3 KB
- `src/styles/assistant-loading.css` <1 KB
- `src/styles/autocomplete.css` 1 KB
- `src/styles/customer-summary.css` 17 KB
- `src/styles/enrichment.css` 2 KB
- `src/styles/location-tags.css` <1 KB
- `src/styles/meeting.css` 8 KB
- `src/styles/next-steps.css` 4 KB
- `src/styles/region.css` 1 KB
- `src/styles/resizable-results.css` 1 KB
- `src/styles/results-layout.css` 3 KB
- `src/styles/review-advisor.css` <1 KB
- `src/styles/shortlist-actions.css` <1 KB
- `src/styles/staff-assistant.css` <1 KB
- `src/styles/staff-sign-in.css` <1 KB
- `src/styles/suggestions.css` 1 KB
- `src/styles/tags.css` 1 KB
- `src/styles/ui-cohesion.css` 27 KB
- `src/styles/ui-polish.css` 2 KB
- `src/styles/urgency.css` 1 KB

## Containers (max-width on layout wrappers)

- `styles.css` `.header-inner` max-width 1080px
- `styles.css` `.staff-strip>div` max-width 1080px
- `styles.css` `.page-wrap` max-width 1080px
- `styles.css` `.footer-inner` max-width 1080px
- `styles.css` `.page-wrap,.header-inner,.footer-inner,.staff-strip>div` max-width 960px
- `customer-summary.css` `.meeting-workspace,.customer-summary-page` max-width 1080px
- `customer-summary.css` `.meeting-main .meeting-workspace,.meeting-main .customer-summary-page` max-width 960px
- `results-layout.css` `.results-bar-inner` max-width 1800px
- `results-layout.css` `.results-main` max-width 1800px
- `results-layout.css` `.results-urgency` max-width 1800px
- `ui-cohesion.css` `.hero h1` max-width 800px
- `ui-cohesion.css` `.hero-copy>p` max-width 680px

## Grids (grid-template-columns)

- `styles.css` `.principles` -> `repeat(3,1fr)`
- `styles.css` `.detail-grid` -> `minmax(0,1fr) 310px`
- `styles.css` `.detail-facts` -> `1fr 1fr`
- `styles.css` `.detail-grid` -> `minmax(0,1fr) 260px`
- `styles.css` `.detail-facts` -> `1fr`
- `styles.css` `.principles` -> `1fr`
- `styles.css` `.detail-grid` -> `1fr`
- `styles.css` `.detail-facts` -> `1fr 1fr`
- `styles.css` `.detail-facts` -> `1fr`
- `styles.css` `.detail-grid` -> `minmax(0,1fr) 300px`
- `styles.css` `.detail-grid` -> `minmax(0,1fr) 270px`
- `styles.css` `.detail-grid` -> `1fr`
- `styles.css` `.detail-facts` -> `1fr`
- `styles.css` `.directory-results-layout` -> `minmax(0,1fr) minmax(0,1fr)`
- `styles.css` `.feedback-review-grid` -> `minmax(0,1fr) minmax(0,1fr)`
- `styles.css` `.feedback-review-grid` -> `1fr`
- `about-facts.css` `.about-facts` -> `1fr`
- `customer-summary.css` `.meeting-grid` -> `minmax(0,1.25fr) minmax(320px,1fr)`
- `customer-summary.css` `.document-meta` -> `1fr 1fr`
- `customer-summary.css` `.meeting-grid` -> `1fr`
- `customer-summary.css` `.document-meta` -> `1fr`
- `meeting.css` `.meeting-workspace` -> `minmax(0,1fr) minmax(0,1fr)`
- `meeting.css` `.meeting-workspace` -> `1fr`
- `meeting.css` `.meeting-live .live-list` -> `repeat(auto-fill,minmax(300px,1fr))`
- `next-steps.css` `.ns-facts>div` -> `170px 1fr`
- `next-steps.css` `.ns-facts>div` -> `1fr`
- `next-steps.css` `.ns-facts` -> `1fr 1fr`
- `next-steps.css` `.ns-facts>div` -> `84px 1fr`
- `region.css` `.region-text>div` -> `minmax(0,1fr) auto`
- `resizable-results.css` `.resizable-results.directory-results-layout` -> `minmax(0,var(--results-list-width,50%)) 8px minmax(0,1fr)`
- `ui-cohesion.css` `.detail-facts` -> `1fr`

## Breakpoints (count per file)

- `styles.css`: max-width:1020px x2, max-width:1140px x1, max-width:370px x2, max-width:650px x5, max-width:750px x3, max-width:850px x1, min-width:1100px x1
- `agent.css`: max-width:600px x1
- `customer-summary.css`: max-width:1020px x1, max-width:500px x2, max-width:650px x1, max-width:850px x2, min-width:1100px x1
- `meeting.css`: max-width:600px x2, max-width:860px x1
- `next-steps.css`: max-width:600px x1
- `region.css`: max-width:750px x1
- `resizable-results.css`: max-width:750px x1
- `results-layout.css`: max-width:1023px x1, max-width:650px x1, max-width:700px x1
- `tags.css`: max-width:450px x1
- `ui-cohesion.css`: max-width:1020px x1, max-width:1249px x1, max-width:380px x4, max-width:600px x1, max-width:750px x5, min-width:1100px x1, min-width:1250px x1
- `ui-polish.css`: max-width:650px x1
- `urgency.css`: max-width:650px x1

## Overrides to remove (counts)

- `styles.css`: !important x18, `body …` selectors x0, `:has()` x3
- `agent.css`: !important x4, `body …` selectors x0, `:has()` x0
- `customer-summary.css`: !important x9, `body …` selectors x0, `:has()` x0
- `meeting.css`: !important x6, `body …` selectors x0, `:has()` x0
- `next-steps.css`: !important x10, `body …` selectors x1, `:has()` x6
- `ui-cohesion.css`: !important x19, `body …` selectors x0, `:has()` x0
- `ui-polish.css`: !important x1, `body …` selectors x13, `:has()` x0

## Classes referenced by Playwright tests (must keep)

`.about-facts`, `.agent`, `.agent-message`, `.agent-page-context`, `.agent-result`, `.directory-result-tags`, `.directory-results-list`, `.directory-results-map`, `.directory-service-detail`, `.enrich-button`, `.import-service-link`, `.leaflet-control-zoom-in`, `.leaflet-control-zoom-out`, `.live-service`, `.map-service-link`, `.panel`, `.report-row`, `.results-bar`, `.results-count`, `.results-main`, `.review-advisor`, `.review-card`, `.review-list`, `.row-diff`, `.saved-directory-services`, `.search-options`, `.service-card`, `.service-map-pin`, `.spinner`, `.toast`, `.workspace-count`
