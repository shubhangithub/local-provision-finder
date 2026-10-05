# Proposal

## Why

Region scoping is currently loose: the "Location" button and picker dialog live inside the Find support search form, the directory agent separately guesses an area from free text (Bristol / Kingston / Bucks), and results are blocked until a location is chosen. Region is really a persistent app-wide setting, not a per-search step, so it should live in one predictable place.

## What Changes

- Add a cog (settings) dropdown to the site header that is the single place to view and change the region scope.
- Move the existing location picker (area list, postcode/town entry, "use current location", draw-on-map area) out of the search form and into that dropdown.
- Persist the chosen region for the session/browser so it applies to every search, the directory agent, and assistant overviews without being re-chosen.
- Remove the in-form "Location" trigger and the "Change location" button; the results heading shows the active region read-only.
- Stop inferring region from free text in the directory agent; it uses the header region.
- Searching with no region set is allowed (all areas) instead of forcing the picker modal.
- Make the meeting page use the header region instead of its own "Find support in" dropdown (falling back to Bristol when none is set, because live transcription needs one area).
- Remove the legacy `#/demo` AB1–AB8 postcode/radius search, its catalogue data and tests, so region is the only location concept.
- Consolidate scattered location code: one region-to-query-params helper, one area list, and removal of dead location styles and duplicated area regexes.
- Redesign the "What do you need help with?" home screen: one prominent search row (field + button), a read-only region indicator with a change link to the header settings, staff "Start meeting" demoted below the search, and responsive stacking on small screens.
- Redesign the search results page: remove the hero and show a compact sticky search bar, then a list column starting at the top beside a full-height map; fold count, filters and map-area notices into one toolbar; make the AI overview a compact collapsible card; use a bottom list/map toggle below 1024px.
- **BREAKING**: the `Choose location` dialog opened from the search form, the meeting area dropdown and the `#/demo` route no longer exist.

## Capabilities

### New Capabilities
- `search-region`: How the user's search region is chosen, persisted, displayed and applied to directory search, map and assistant requests.

- `support-search-home`: Layout and hierarchy of the home search screen.

- `search-results-layout`: Layout, hierarchy and responsive behaviour of the results list, map and overview.

### Modified Capabilities

## Impact

- `src/App.tsx` (home screen markup, header, state wiring; delete legacy demo search form, `parsePostcode` flow, `demoSearch`, URL postcode params), `src/lib/search.ts`, `src/data/catalogue.ts` postcode lookup, `src/types.ts` (`postcode`, `radius`, `includeRemote`, `postcodePrefixes` if unused elsewhere), `src/components/MeetingDemo.tsx` and `src/lib/live-meeting.ts` (area from region), `src/lib/agent.ts` (`AgentContext.area`), `src/components/LocationSearch.tsx` (remove picker/trigger, consume region), `src/components/DirectoryAgent.tsx` (drop area inference), `src/components/PublicAssistant.tsx` (region from context; compact collapsible variant), `src/components/ServicesMap.tsx` (picker mode reused) and `ResizableResults.tsx` (full-height split), plus styles for the header dropdown, home and results layouts.
- `tests/map.spec.ts` and `tests/location.spec.ts` (move to the dropdown); `tests/app.spec.ts`, `tests/accessibility.spec.ts`, `src/lib/search.test.ts` (legacy demo coverage deleted or ported).
- No API or dependency changes; `/api/imports` params (`area`, `lat`, `lng`, `bounds`) are unchanged.
