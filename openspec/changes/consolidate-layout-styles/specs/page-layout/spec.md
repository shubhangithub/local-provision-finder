# Spec Delta

## Purpose

Gives every page of the app one consistent frame and a small set of reusable grids, so that headers, content and footers line up and pages behave the same at every screen size.

## ADDED Requirements

### Requirement: Shared frame with two width variants
The system SHALL lay out every page inside one frame that has a reading width and a wide width, and each page SHALL use exactly one of them.

#### Scenario: Reading page
- **WHEN** a content page such as the home page, a service's details, saved services or a staff page is shown
- **THEN** it uses the reading width, centred

#### Scenario: Wide page
- **WHEN** the search results or the live meeting is shown
- **THEN** it uses the wide width, centred, so a list and a map have room side by side

### Requirement: Header, staff bar and footer follow the page
The site header, the staff account bar, the staff workspace navigation and the footer SHALL take the same width and left edge as the page content they sit above or below.

#### Scenario: Search results
- **WHEN** the search results are shown at a screen wider than the wide width
- **THEN** the brand, navigation, search bar, results and footer share one left edge and one right edge

#### Scenario: Moving between pages
- **WHEN** a person moves from a reading page to the search results
- **THEN** the header and footer resize to the new page's width, and no element is aligned to a different width from its neighbours

#### Scenario: Staff navigation
- **WHEN** a staff member is signed in on any page
- **THEN** the staff bar and workspace navigation align with the page content without fixed widths

### Requirement: One gutter
The system SHALL use one horizontal gutter at each screen size for the frame, and SHALL NOT let a page define its own side margins.

#### Scenario: Gutter at each size
- **WHEN** the same page is shown on a phone and on a desktop
- **THEN** content is inset by the phone gutter on the phone and the desktop gutter on the desktop, on every page

### Requirement: Main-and-side layout
The system SHALL use one main-and-side layout wherever a page has a primary column and a secondary column, and the secondary column SHALL stack below the primary on narrow screens.

#### Scenario: Service details
- **WHEN** a service's details are shown on a wide screen
- **THEN** the details are in the main column and the contacts and staff controls are in a side column of fixed width

#### Scenario: Narrow screen
- **WHEN** the same page is shown on a phone
- **THEN** the side column appears below the main column at full width

### Requirement: List-and-map split
The system SHALL use one split layout wherever a list sits beside a map, including a resizable divider, and SHALL show the list and map as alternatives on narrow screens.

#### Scenario: Wide screen
- **WHEN** the search results are shown on a wide screen
- **THEN** the list and the map are side by side, and the divider can be dragged or moved with the keyboard

#### Scenario: Narrow screen
- **WHEN** the search results are shown on a phone
- **THEN** a toggle switches between the list and the map

### Requirement: Few breakpoints
The system SHALL change layout at three screen widths only (phone, tablet, wide), and every page SHALL use the same ones.

#### Scenario: Between breakpoints
- **WHEN** the screen width is resized between any two widths
- **THEN** layout changes only at the three defined widths

### Requirement: No horizontal scrolling
The system SHALL NOT make a page scroll sideways at any screen width from 320px up.

#### Scenario: Smallest screen
- **WHEN** any page is shown at 320px wide
- **THEN** all content fits within the screen without horizontal scrolling

### Requirement: Existing pages keep their appearance
The layout change SHALL NOT alter the content, behaviour or component styling of a page beyond alignment, spacing and width differences.

#### Scenario: Before and after
- **WHEN** screenshots of each page are compared before and after the change at phone, tablet and desktop widths
- **THEN** every difference is an intended alignment, width or spacing change
