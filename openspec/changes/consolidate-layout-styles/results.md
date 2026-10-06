# Results (tasks 7.1 and 5.1)

Final screenshots compared with the baseline taken before any change (32 captures, pages x 320/390/768/1440/1920).
No page scrolls sideways at 320, 360, 375 or any captured width. The header, content and footer share one left and right inset on every page at 390, 768, 1440 and 1920.

## Remaining differences and why

| Page / width | Difference | Reason |
|---|---|---|
| Every page at 390 | Content inset 16px, not 20-30px; header and content now share it | One gutter (spec: One gutter) |
| Every page at 768 | Content inset 24px, not 20-30px | One gutter |
| Search results at 1440 and 1920 | Brand and nav align with the search bar and list; header is one row, so the page is ~43px shorter; at 1920 the page is capped at 1440 | Wide frame (spec: header follows page) |
| Service details | Main column is 6px wider at 1440 (gap 24px, not 30px); side column 260px at tablet | Shared main-and-side grid |
| Live meeting at 1440 | Header, staff nav and content use the wide frame | Meeting is a wide page |
| Saved page at 390 | Inset 16px, not 20px | Legacy `.saved-page` margins removed |
| Tiny phones (below 380px) | Cosmetic tweaks (smaller fonts and gaps) removed | Breakpoints reduced to three; no overflow at 320px |

All other captures are pixel-identical (10 of 32 identical; the rest differ only as above).

## Breakpoints

Layout structure sampled every 8px from 320 to 1920 on home, results, detail and feedback changes only between 632 and 640px, and between 1016 and 1024px.

## Not done

Group 6 (folding `ui-cohesion.css`, `ui-polish.css` and `results-layout.css` into layers, deleting dead rules, removing `!important` overrides, wrapping component stylesheets) is not done. `docs/layout.md` lists what is left.
