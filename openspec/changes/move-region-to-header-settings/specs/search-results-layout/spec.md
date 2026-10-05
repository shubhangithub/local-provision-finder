# Spec Delta

## Purpose

Defines the layout of the search results page so that results are visible immediately beside a full-height map, with search, filters and the AI overview kept compact rather than pushing results down.

## ADDED Requirements

### Requirement: Results page is a list and full-height map split
On wide screens the results page SHALL show the results list in a left column and a map filling the full available height in a right column, both visible together.

#### Scenario: Desktop results
- **WHEN** a search returns results at a viewport 1024px wide or more
- **THEN** the list is on the left and the map on the right extends from below the header search bar to the bottom of the viewport
- **AND** the map stays in view while the list is scrolled

#### Scenario: Resize split
- **WHEN** the user drags or uses arrow keys on the divider
- **THEN** the list/map widths change within 25%–75%

### Requirement: Results start at the top of the list column
The first service card SHALL be visible without scrolling at 1280x720, with the hero removed and only a compact search bar, result count and filters above it.

#### Scenario: First result above the fold
- **WHEN** results are displayed at 1280x720
- **THEN** at least one service card is fully visible without scrolling

### Requirement: Compact search bar stays available
While results are shown, the search field, submit button and active region indicator SHALL appear in a compact bar at the top of the page that remains visible during scrolling.

#### Scenario: Refine search
- **WHEN** the user edits the query in the compact bar and submits
- **THEN** results, count, map and overview update without leaving the page

### Requirement: AI overview is compact and does not displace results
The AI overview SHALL render as a compact collapsible card with its summary visible and details expandable, and MUST NOT push the first result below the fold in its collapsed state.

#### Scenario: Overview loading and loaded
- **WHEN** the overview is loading or collapsed
- **THEN** it occupies at most one summary-card height above the list and results remain usable

#### Scenario: Expand overview
- **WHEN** the user expands the overview
- **THEN** next steps, citations and discovered suggestions are shown inside the card

### Requirement: Filters and status sit in one toolbar
Result count, the "include services with no recorded location" option, map-area reset and keyword-fallback notices SHALL be grouped in a single toolbar above the list.

#### Scenario: Map area active
- **WHEN** the user has moved the map to restrict results
- **THEN** the toolbar shows the restriction and a control to reset it

### Requirement: Cards and map are linked
Hovering, focusing or selecting a card SHALL highlight its map marker, and selecting a marker SHALL highlight and scroll to its card.

#### Scenario: Marker selection
- **WHEN** the user selects a map marker
- **THEN** the matching card is highlighted and scrolled into view

### Requirement: Small screens switch between list and map
Below 1024px the page SHALL show either the list or the map, switched by a persistent control reachable with one hand, defaulting to the list.

#### Scenario: Phone
- **WHEN** the viewport is 375px wide
- **THEN** the list is shown with a list/map toggle fixed at the bottom
- **AND** choosing Map shows the full-height map and the same toggle

### Requirement: Loading, empty and error states stay in the layout
Loading, no-results and error messages SHALL appear in the list column while the map remains visible.

#### Scenario: No results
- **WHEN** a search returns no services
- **THEN** the list column explains this and suggests changing words or region, and the map stays visible
