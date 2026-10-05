# Spec Delta

## Purpose

Defines how the results map is first framed so that the pins for the current results are visible without the user having to resize or move the map.

## ADDED Requirements

### Requirement: Pins are visible on first render
When results with recorded locations are shown, the map SHALL display at least one pin for them in the initial view without any user interaction.

#### Scenario: Results appear
- **WHEN** a search returns services with coordinates
- **THEN** pins for those services are visible inside the map without resizing or panning

### Requirement: View fits the results when nothing else fixes it
When no area, current location or map bounds fix the view, the map SHALL fit its view to the results' pins; when one does, the view SHALL stay on it.

#### Scenario: No region
- **WHEN** no region is set and results span several areas
- **THEN** the map frames the pins rather than centring on a single default area

#### Scenario: Region set
- **WHEN** a region with an area is set
- **THEN** the map centres on that area as before

### Requirement: Map refits when its container settles
The map SHALL recompute its size and re-apply the initial framing when its container first gets, or changes to, a non-zero size, without treating that as a user move that narrows the search.

#### Scenario: Layout settles after mount
- **WHEN** the map mounts before its container has final dimensions
- **THEN** once sized it shows the pins and the result list is unchanged

### Requirement: Framing does not narrow the search
Automatic framing MUST NOT trigger a map-bounds search; only user pan or zoom does.

#### Scenario: Auto-fit
- **WHEN** the map auto-fits to results
- **THEN** no new search request with bounds is sent
