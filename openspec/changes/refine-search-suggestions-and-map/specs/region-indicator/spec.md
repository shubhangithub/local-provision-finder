# Spec Delta

## Purpose

Defines when the active region is shown to the user so that the interface mentions a region only when one is actually restricting results.

## ADDED Requirements

### Requirement: Region indicator appears only when a region is set
The system SHALL show "Searching in <region> · Change" beside the search field only while a region is set, and MUST NOT show any "all areas" text there.

#### Scenario: No region
- **WHEN** no region is set
- **THEN** the home screen and the results bar show no "Searching in" line

#### Scenario: Region set
- **WHEN** the region is Bristol
- **THEN** "Searching in Bristol" and a Change control are shown beside the search field

### Requirement: No-region state is neutral elsewhere
When no region is set the header cog SHALL show only the cog icon with an accessible name of "Region settings", and the results heading SHALL read "Search results" rather than naming areas.

#### Scenario: Header with no region
- **WHEN** no region is set
- **THEN** the cog shows no area text and its accessible name is "Region settings"

#### Scenario: Results heading with no region
- **WHEN** a search runs with no region
- **THEN** the heading reads "Search results"

### Requirement: Region can still be reached when none is set
The system SHALL keep the header cog as the way to set a region when no indicator is shown.

#### Scenario: Set a region from the header
- **WHEN** no region is set and the user opens the cog
- **THEN** the dropdown offers the area, postcode, current location and map controls
