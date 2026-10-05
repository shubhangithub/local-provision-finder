## Context

`LocationSearch.tsx` owns `place`/`bounds` state and a `<dialog>` picker (area select, postcode form, geolocation, `ServicesMap picker`). `DirectoryAgent.tsx` separately regex-matches Bristol/Kingston/Bucks. The header lives in `App.tsx`. Region therefore sits in three disconnected places.

## Goals / Non-Goals

**Goals:** one app-level region state, edited only from a header dropdown, consumed by search, assistant and agent.
**Cleanup goal:** after this change there is exactly one location concept (region), one area list (`directoryAreas`), and one place that turns a region into query params.
**Non-Goals:** new regions/data, API changes, other settings in the cog (it is built so more could be added later), staff-only scoping.

## Decisions

- **Region store**: a small `src/lib/region.ts` module with a `useRegion()` hook (React state + `localStorage` + a `region-changed` window event, matching the existing `directory-saved-changed` pattern). Alternative: lift state into `App` props — rejected as it threads through many routes.
- **Shape**: reuse the existing `Place` (`label`, `area?`, `lat?`, `lng?`, `bounds?`); `null` means all areas. Persist as JSON; ignore invalid data.
- **Dropdown component**: new `RegionMenu.tsx` using a button with `aria-expanded`/`aria-controls` and a popover panel (not the modal `<dialog>`), closing on Escape/outside click. The picker body is extracted from `LocationSearch` and reused, including `ServicesMap picker` and its fetch of map records (fetched only while open).
- **LocationSearch**: reads region via `useRegion()`; the search effect runs whenever region changes, and runs with no region (`area` omitted) rather than gating on `place`. Remove trigger, dialog and "Change location". Keep the "Reset to selected location" map-bounds behaviour, which is a results-view refinement, not region selection.
- **Search form consolidation**: the form becomes just search input + submit. All picker state and handlers move into `RegionMenu`/`useRegion`, so `LocationSearch` only reads the region and fetches. Copy that tells users to "choose an area" is reworded to point at the header settings.
- **Home layout**: markup stays `hero` then `finder-section`, but the form becomes one row (`SearchAutocomplete` + submit button) with a small "Searching in <region> · Change" line under it that calls the header menu's open function (shared via `useRegion`/a small open-state hook or custom event). Urgency notice stays directly below. Staff meeting entry moves below the form. Alternative: a separate landing component — rejected, the same form is reused above results.
- **CSS**: `directory-search-form`, `directory-search-controls`, `.hero` rules are duplicated between `styles.css` and `ui-cohesion.css`; the redesign consolidates them into one block (ui-cohesion wins today) and deletes the `location-trigger` rules.
- **Results layout**: when results exist, `LocationSearch` renders a full-bleed shell (`results-shell`) instead of the 960/1240px `page-wrap`: a sticky compact bar (query + submit + region line, ~64px) then a two-column grid. The map is `position:sticky; top:<bar height>; height:calc(100vh - <header+bar>)` and the list flows with normal page scroll, avoiding nested scroll containers. `ResizableResults` keeps its divider and 25–75% clamp. Alternative: independently scrolling list pane — rejected as it traps wheel/touch scrolling and breaks in-page find and focus scrolling.
- **Hero and routing**: the hero is hidden whenever results or detail exist (already partly done via `:has()`); replace the `:has()` selectors with an explicit `data-state="results"` on the container to simplify CSS.
- **Toolbar**: new `ResultsToolbar` holds count, unknown-location checkbox, map-area reset, keyword-fallback note and (on mobile) is where the urgency notice collapses to one line. The old `location-results-heading` ("Support in …") becomes the toolbar title.
- **Overview card**: `PublicAssistant` gets a `compact` mode: header + summary with a "Show details" `<details>`-style disclosure for next steps, citations, discoveries and warnings; it is closed by default. Loading shows the existing spinner on one line. Its request lifecycle is unchanged.
- **Mobile**: below 1024px the existing `view` state drives list vs map; the toggle moves to a fixed bottom segmented control and the map takes `100dvh` minus bars. Desktop no longer needs the toggle, so it is hidden at >=1024px.
- **Agent**: delete the mentioned-area regex; pass the header region params. Alternative: keep inference as an override — rejected, contradicts single-source scoping.
- **Meetings**: `MeetingDemo` drops its `meetingArea` select and `area` prop; it takes `region?.area ?? 'Bristol'`. The server already validates the area against `directoryAreas` in `realtime-api.ts` and stays unchanged. Non-area regions (postcode, coordinates, map bounds) fall back to the nearest `directoryAreas` entry via `areaCentre` or Bristol; confirm during implementation.
- **Legacy demo removal**: delete the `#/demo` route and redirect it to `#/`, `findServices`/`parsePostcode`/`defaultQuery`, the postcode search form and `SearchOptions`, URL `postcode/radius/remote` parsing, the `postcodeLookup` catalogue data and related types/styles, then check which of `catalogue.ts`, `review.ts` and `types.ts` are still used by staff review before deleting shared pieces. Port or delete `app.spec.ts`/`accessibility.spec.ts` demo cases and `search.test.ts`.
- **Dedupe**: one `regionParams(region)` helper replaces the hand-built param objects in `LocationSearch`, `SearchAutocomplete` and `PublicAssistant`; the area-name regexes (Bristol/Kingston/Bucks) in the picker submit and agent are replaced by lookup in `directoryAreas`. Remove now-unused location CSS in `styles.css`/`ui-cohesion.css`.
- **Persistence**: `localStorage` (spec says session/reload); wrap access in try/catch.

## Risks / Trade-offs

- [Discoverability: users may not notice the cog] → show the region name next to the cog in the header and in the results heading.
- [Searching all areas may return unscoped/irrelevant results or heavier queries] → confirm `/api/imports` handles empty `area`; picker already queries `area=` empty.
- [Legacy removal may orphan or break staff review code that shares `catalogue`/`review` modules] → grep usages before deleting; delete only what is unreferenced, keep the rest.
- [Existing e2e tests rely on the dialog] → update `tests/map.spec.ts` and any other flows to use the dropdown.
- [Popover small on mobile with embedded map] → render full-width sheet under 640px.

- [Redesign details are subjective] → assumptions above are implemented first, then reviewed in the browser at desktop and 375px before finishing; adjust spacing/hierarchy without changing the spec requirements.

- [Sticky bars plus a full-height map can overflow short viewports] → compute heights from CSS variables, enforce a minimum map height of 320px and fall back to stacked layout under 640px height.
- [Compact overview hides content users relied on] → keep the summary visible; the disclosure is labelled "Show details" and holds next steps, evidence, discoveries and warnings.

## Migration Plan

Frontend only; ship in one release. No stored data exists yet, so no migration. Rollback is a revert.

## Open Questions

- Meeting fallback when the region is a postcode/map area rather than a named area (assumed: nearest named area, else Bristol).
- Default region on first visit: all areas (assumed) vs. Bristol.
