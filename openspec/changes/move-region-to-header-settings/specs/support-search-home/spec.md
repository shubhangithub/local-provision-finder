# Spec Delta

## Purpose

Defines the layout of the "What do you need help with?" home screen so that describing a need is the single, obvious first action and the page stays clear once the region moves to the header.

## ADDED Requirements

### Requirement: Search is the primary action on the home screen
The home screen SHALL present the heading, a one-line hint, and one prominent search field with its submit button on a single row, with no other form controls competing for attention.

#### Scenario: First visit
- **WHEN** a user opens the home screen with no search made
- **THEN** the heading, hint, search field and submit button are visible above the fold at 1280x720 and 375x812
- **AND** no location control is shown inside the search area

#### Scenario: Narrow screens
- **WHEN** the viewport is 375px wide
- **THEN** the field and button stack vertically, with no horizontal scrolling and touch targets of at least 44px

### Requirement: Current region is indicated near the search
The home screen SHALL show the active region (or "All areas") as read-only text near the search field, with a way to open the header region settings.

#### Scenario: Region shown
- **WHEN** the region is Bristol
- **THEN** the text "Bristol" appears near the search field
- **AND** activating its change link opens the header region dropdown

### Requirement: Staff meeting entry does not crowd the search
For signed-in staff, the "Start meeting" entry SHALL appear after the search area as a secondary action.

#### Scenario: Staff view
- **WHEN** a staff user opens the home screen
- **THEN** the search field remains the first interactive element in the main content and "Start meeting" follows it

### Requirement: Layout is accessible
The search field SHALL keep its accessible name "What do you need help with?", the urgency notice SHALL stay directly below the field, and focus order MUST follow visual order.

#### Scenario: Keyboard use
- **WHEN** a user tabs from the skip link
- **THEN** focus reaches the search field before any other main-content control

### Requirement: Layout adapts when results are shown
When results or a service detail are shown, the layout SHALL keep the existing behaviour of collapsing the hero and widening the results area.

#### Scenario: Results displayed
- **WHEN** a search returns results
- **THEN** the search field remains visible above the results and the map/list layout is unchanged
