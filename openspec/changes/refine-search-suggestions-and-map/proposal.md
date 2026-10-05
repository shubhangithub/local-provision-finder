# Proposal

## Why

Three rough edges remain after the region and layout redesign: the search shows "Searching in all areas" noise when no region is set, the typeahead below the search field recommends individual services instead of helping the user phrase a search, and the results map can show no pins until the user resizes it.

## What Changes

- Show the region indicator only when a region is set; never show "all areas" wording on the home screen, the header cog or the results heading.
- Replace the service-name typeahead with search term suggestions (needs, categories, tags and curated terms) drawn from the directory; choosing one fills the field and searches. Services stay in the results list, not the dropdown.
- Make the results map show its pins on first render by fitting the view to the results when no explicit area or bounds fix the view, and by re-fitting once the container has its final size.

## Capabilities

### New Capabilities
- `search-suggestions`: Term suggestions offered while typing in the search field.
- `results-map`: Initial framing and pin visibility of the results map.
- `region-indicator`: Where the active region is and is not shown, including the no-region state.

### Modified Capabilities

## Impact

- `src/components/SearchAutocomplete.tsx`, `src/components/LocationSearch.tsx`, `src/components/RegionMenu.tsx` (trigger label), `src/components/ServicesMap.tsx`, new `server/suggest-terms.ts` and wiring in `server/imports.ts` (or a new `/api/suggest` route), `src/data/catalogue.ts` search terms.
- `tests/urgency-autocomplete.spec.ts`, `tests/region.spec.ts`, `tests/map.spec.ts`, `tests/ui-polish.spec.ts`.
- Note: the earlier change `move-region-to-header-settings` has not been archived, so its specs are not yet in `openspec/specs/`. These deltas are therefore new capabilities; archive that change first so `region-indicator` can later be merged with `search-region`.
