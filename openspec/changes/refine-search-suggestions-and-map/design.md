## Context

- Typeahead: `SearchAutocomplete` calls `/api/imports?q=…&mode=semantic` and lists the first 5 records as "Suggested services". Directory records carry `categories`, `needs` and `tags`; the workbook has 8 curated "Search Terms".
- Map: `ServicesMap` initialises Leaflet with `setView(centre, 12)` from `areaCentre(area)` (Bristol by default) and `invalidateSize` on resize. With no region, results span Bristol, Kingston and Buckinghamshire, so the default view can contain no pins until the user resizes, which fires a user-move bounds search that narrows results to what is visible. Observation: with Bristol selected, pins were visible (47 of 68 in the viewport); the no-region and late-layout cases are the likely failures and need to be reproduced first.
- Indicator: `LocationSearch` always renders the region line, `RegionMenu` labels the trigger "All areas", and the heading says "Support in all areas".

- Map root causes found while reproducing: (1) with a map-area region (bounds only) the view key did not change, so the mounted map never moved to the new bounds; (2) a map hidden by the mobile list/map switch was not re-framed when shown; (3) roughly 2% of site records carry 0,0 coordinates, so any naive fit-to-all-pins zooms out to the Gulf of Guinea. Pins were already visible for a freshly mounted map with a named area.

## Goals / Non-Goals

**Goals:** term suggestions from the directory vocabulary; neutral no-region UI; pins visible on first render.
**Non-Goals:** AI-generated suggestions, query history, changing result ranking, changing the map-moves-search behaviour.

## Decisions

- **Suggestion source and endpoint**: new `GET /api/suggest?q=&area=` backed by `server/suggest-terms.ts`. Vocabulary = curated Search Terms + each record's `needs`, `categories` and `tags`, lowercased and trimmed, with a count of carrying services (per area when `area` is given). Rank: prefix match, then word-prefix match, then substring, tie-break by count then alphabetically; cap at 6. Alternative: derive terms from the semantic search results — rejected, it yields service names, which is the current problem. Alternative: LLM suggestions — rejected for cost and latency; no API key needed here.
- **Caching**: build the vocabulary in memory and rebuild it when it is more than 30 seconds old, so staff tag changes and catalogue refreshes appear shortly after; the endpoint is otherwise a pure in-memory lookup.
- **Client**: `SearchAutocomplete` fetches `/api/suggest`, drops the record shape (`DirectorySummary`), renders "Suggested searches" with plain term options, and keeps the debounce (350ms), min length (2 instead of 3), and keyboard handling. `onChoose(term)` now searches; the urgency detection that runs on field text is unchanged.
- **Indicator**: render the region line only when `region` is set; drop the "All areas" label from `RegionMenu` (cog only, `aria-label="Region settings"`; text only when set); heading becomes "Search results" with no region. Update the dropdown copy "Searching all areas" to a neutral "No region set".
- **Map framing**: add a `fitToServices` behaviour in `ServicesMap` used when no `area`, `origin` or `bounds` is supplied: after the first non-zero size, `fitBounds` over all service sites (padding 40px, maxZoom 13) with `ignoreMove` set so it is not reported as a user move. Re-run on container size becoming non-zero and when the result set changes while the user has not moved the map. With `area`/`origin`/`bounds`, keep the current centring. Also call `invalidateSize` after the first layout frame (`requestAnimationFrame`) before applying the view.
- **Diagnose first**: reproduce "no pins until resize" with no region, with a region, and on mobile before changing code, and record which case(s) reproduce.

## Risks / Trade-offs

- [Vocabulary contains noisy or overly long tags] → filter to terms of 2–40 characters, require at least one carrying service, and drop terms that are identical to a service name.
- [Fitting to all pins zooms out to three counties] → cap zoom and accept; the region control is the way to narrow.
- [Auto-fit fights user panning] → only auto-fit until the first user interaction on that result set.
- [Existing tests assert service suggestions] → update `urgency-autocomplete.spec.ts` to terms and add `/api/suggest` unit tests.

## Migration Plan

Frontend and one new read-only endpoint; no data migration. Rollback is a revert.

## Open Questions

- Should empty-region searches default the header to "Region settings" only (assumed) or hide nothing?
