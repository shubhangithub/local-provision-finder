## 1. Region indicator

- [x] 1.1 Render the "Searching in … · Change" line in `LocationSearch.tsx` only when a region is set
- [x] 1.2 Make the `RegionMenu.tsx` trigger icon-only with `aria-label="Region settings"` when no region is set, and show the region label only when set; reword "Searching all areas" in the dropdown to "No region set"
- [x] 1.3 Change the no-region results heading to "Search results"

## 2. Search term suggestions

- [x] 2.1 Add `server/suggest-terms.ts` building the vocabulary (curated Search Terms plus `needs`, `categories`, `tags`) with per-area counts, filtering and ranking as designed, with unit tests
- [x] 2.2 Expose `GET /api/suggest?q=&area=` returning up to 6 terms; refresh the vocabulary when older than 30 seconds
- [x] 2.3 Rewrite `SearchAutocomplete.tsx` to call `/api/suggest`, list "Suggested searches", lower the minimum length to 2, and keep debounce, keyboard and aria behaviour
- [x] 2.4 In `LocationSearch.tsx` pass the region area to the suggestion request and make choosing a term fill the field and search
- [x] 2.5 Update `tests/urgency-autocomplete.spec.ts` for term suggestions and add tests for ranking, region limiting and failure fallback

## 3. Map pins on first render

- [x] 3.1 Reproduce "no pins until resize" with no region, a region and the mobile viewport; note the cause in a code comment or the design
- [x] 3.2 In `ServicesMap.tsx` call `invalidateSize` after first layout and re-apply the initial view when the container first gets a non-zero size
- [x] 3.3 Fit the view to the services' pins when no `area`, `origin` or `bounds` is given, without reporting it as a user move; re-fit on result changes until the user moves the map
- [x] 3.4 Add e2e tests: pins visible in the initial view with no region and with a region, and no bounds request is sent by auto-fit

## 4. Verify

- [x] 4.1 Update existing specs referencing "all areas" text (`tests/region.spec.ts`) and run unit and e2e suites on desktop and mobile
- [x] 4.2 Check the results and home screens manually at 1280x720 and 375x812
