# Spec Delta

## Purpose

Defines how the user's search region is selected and applied, so that region scoping is controlled from one place and consistently affects directory results, the map and assistant answers.

## ADDED Requirements

### Requirement: Region is controlled from a header cog dropdown
The system SHALL provide a cog button in the site header that opens a dropdown containing all region controls, and SHALL NOT offer region selection anywhere else in the page.

#### Scenario: Open region settings
- **WHEN** the user activates the header cog button
- **THEN** a dropdown opens showing the current region and the controls to change it
- **AND** the button reports its expanded state to assistive technology

#### Scenario: Dismiss dropdown
- **WHEN** the dropdown is open and the user presses Escape or clicks outside it
- **THEN** the dropdown closes and focus returns to the cog button

#### Scenario: No in-page location picker
- **WHEN** the user views the search form or an empty results state
- **THEN** no location trigger or "Change location" control is shown

### Requirement: Region can be set by area, postcode, current location or map
The dropdown SHALL let the user set the region by choosing a named area, entering a town or postcode, using their current location, or selecting a map area, and SHALL allow clearing it back to all areas.

#### Scenario: Choose a named area
- **WHEN** the user selects "Bristol" in the dropdown
- **THEN** the region becomes Bristol and the dropdown shows it as active

#### Scenario: Location permission declined
- **WHEN** the user chooses current location and the browser denies access
- **THEN** an error is shown in the dropdown and the previous region is kept

#### Scenario: Clear region
- **WHEN** the user clears the region
- **THEN** searches are no longer limited to an area

### Requirement: Region persists across searches
The system SHALL keep the chosen region for the rest of the browser session and apply it to every directory search, map view and assistant request without re-prompting.

#### Scenario: Region applied to new search
- **WHEN** a region is set and the user submits a search
- **THEN** results and the assistant overview are scoped to that region

#### Scenario: Region survives reload
- **WHEN** a region is set and the page is reloaded
- **THEN** the same region is still active

### Requirement: Changing region updates results
The system SHALL re-run the current search when the region changes.

#### Scenario: Change region with results shown
- **WHEN** results are displayed and the user selects a different region
- **THEN** the results, count, map and heading update to the new region on page 1

### Requirement: Searching without a region is allowed
The system SHALL run a search when no region is set, covering all areas, and MUST NOT open a location dialog.

#### Scenario: Search with no region
- **WHEN** no region is set and the user submits a search
- **THEN** results for all areas are shown with the heading indicating all areas

### Requirement: Active region is visible and read-only outside the dropdown
The system SHALL show the active region in the header cog control and in the results heading.

#### Scenario: Region shown
- **WHEN** a region is set
- **THEN** the header control and results heading name that region

### Requirement: Directory agent uses the header region
The directory agent SHALL scope its searches to the header region and MUST NOT infer a different region from the wording of the user's message.

#### Scenario: Message mentions another area
- **WHEN** the region is Bristol and the user asks the agent about services in Kingston
- **THEN** the agent searches within Bristol and tells the user the region can be changed in settings

### Requirement: Meetings use the header region
The meeting page SHALL scope live suggestions to the header region, SHALL NOT offer its own area selector, and SHALL use Bristol when no region is set.

#### Scenario: Meeting with region set
- **WHEN** the region is Kingston and the user starts a meeting
- **THEN** transcription and suggestions are scoped to Kingston

#### Scenario: Meeting with no region
- **WHEN** no region is set and the user starts a meeting
- **THEN** Bristol is used and the meeting page states which area is in use

### Requirement: Region is the only location concept
The system SHALL NOT offer a separate postcode, radius or demo-area search; all location scoping MUST come from the region.

#### Scenario: Legacy demo route
- **WHEN** a user opens the former `#/demo` address
- **THEN** they land on the standard Find support page
