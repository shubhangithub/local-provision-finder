# Spec Delta

## Purpose

Defines the suggestions offered while typing in the search field so they help the user phrase a search instead of recommending individual services.

## ADDED Requirements

### Requirement: Suggestions are search terms, not services
While the user types at least 2 characters, the system SHALL offer up to 6 suggested search terms and MUST NOT list individual services or providers as suggestions.

#### Scenario: Typing a need
- **WHEN** the user types "anx"
- **THEN** suggestions such as "anxiety" appear, labelled "Suggested searches"
- **AND** no service or provider names are offered

### Requirement: Suggestions come from the directory vocabulary
Suggested terms SHALL be drawn from curated search terms and the needs, categories and tags recorded on directory services, deduplicated case-insensitively and ranked by prefix match, then word match, then how many services carry the term.

#### Scenario: Ranking
- **WHEN** the user types "food"
- **THEN** terms starting with "food" appear before terms merely containing it
- **AND** each term appears once

### Requirement: Suggestions respect the region
When a region is set, terms SHALL be limited to those carried by services in that region.

#### Scenario: Region-limited terms
- **WHEN** the region is Kingston and the user types "food"
- **THEN** only terms present on Kingston services are suggested

### Requirement: Choosing a suggestion searches
Choosing a suggestion SHALL fill the search field with that term and run the search; the keyboard behaviour of the list (arrow keys, Enter, Escape) SHALL be unchanged.

#### Scenario: Select with keyboard
- **WHEN** the user presses ArrowDown then Enter on "anxiety"
- **THEN** the field contains "anxiety", the list closes and results for "anxiety" are shown

#### Scenario: Escape
- **WHEN** the list is open and the user presses Escape
- **THEN** the list closes and the field keeps its text

### Requirement: Suggestions never block searching
A failed or slow suggestion request SHALL NOT prevent the user from submitting their own words.

#### Scenario: Suggestions unavailable
- **WHEN** the suggestion request fails
- **THEN** no list is shown and pressing Find support still searches
