# Layout

How pages are framed and laid out. The rules live in `src/styles/layout.css` and `src/styles/tokens.css`; this page explains the system so a new page does not need its own widths, margins or breakpoints.

## Tokens (`src/styles/tokens.css`)

| Token | Value | Use |
|---|---|---|
| `--page-width` | 960px | Reading width: home, service details, saved, suggest, staff pages |
| `--page-width-wide` | 1440px | Wide width: search results and the live meeting |
| `--gutter` | 16px, 24px from 640px up | The one side inset for the frame |
| `--side-width` | 300px | Secondary column beside a main column |
| `--space-1` … `--space-8` | 4, 8, 12, 16, 24, 32, 48, 64px | Spacing scale for layout rules |

## The frame

Every page, and the header and footer around it, share one width and one gutter (`.page-wrap`, `.header-inner`, `.footer-inner` and the results containers all use the same rule in `layout.css`). A page is "reading" unless it asks for "wide". To ask, render `<PageWidthClaim width="wide"/>` while the page is on screen, or call `usePageWidth('wide')` (`src/lib/page-width.ts`). The width is a `data-width` attribute on `<html>`, so the header and footer resize with the page.

Do not set `max-width`, side `margin` or side `padding` on a page wrapper. Use `.page-wrap` and let the frame decide.

## Grids

- `.grid-main-side`: a main column and a side column of `--side-width`. It stacks on a phone, and the side column narrows to 260px on a tablet. Add `.grid-main-side--even` for two equal columns that stack until the wide breakpoint (the feedback review).
- `.grid-split`: a list and a map with a draggable divider (`--results-list-width`). Below the wide breakpoint the two stack, and the results page's toggle shows one at a time.

## Breakpoints

Three: phone (below 640px, the default), tablet (from 640px) and wide (from 1024px). Custom properties cannot be used inside `@media`, so write `639px` or `640px`, and `1023px` or `1024px`, literally.

## Cascade layers

`tokens, base, layout, components, pages` are declared in `tokens.css`, lowest priority first. CSS outside any layer beats every layer, so only the new rules (`tokens.css`, `layout.css`) are layered so far. When a layered rule must replace a legacy one, delete the legacy rule in the same change.

## Status

Done: tokens, the shared frame and its two widths, the two grids, and the reduction to three breakpoints. Not done: merging `ui-cohesion.css`, `ui-polish.css` and `results-layout.css` into the layers, deleting dead rules (for example `.meeting-grid`, `.meeting-workspace` and `.principles` are not used by any component), removing the remaining `!important` and `body …` overrides, and moving the header off viewport breakpoints. See `openspec/changes/consolidate-layout-styles/tasks.md`.
