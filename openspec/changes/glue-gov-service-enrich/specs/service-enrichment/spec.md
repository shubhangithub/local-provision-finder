# Spec Delta

## Purpose

Lets staff enrich a directory service with sourced facts and searchable text researched from the open web, while keeping every automatic change visible, attributable and reversible.

## ADDED Requirements

### Requirement: Staff can start enrichment
The system SHALL let signed-in staff start enrichment of a single service from an Enrich service profile control that shows progress while it runs, and SHALL NOT enrich any service without that action.

#### Scenario: Staff enrich a service
- **WHEN** staff click Enrich service profile on a service
- **THEN** the system submits the service's name and known details to the enrichment service and shows a spinner and an in-progress message until the job ends

#### Scenario: Enrichment is not configured
- **WHEN** the enrichment service address or token is not set
- **THEN** the Enrich service profile control is disabled and states that enrichment is not configured

#### Scenario: Enrichment service fails
- **WHEN** the job ends in an error or cannot be reached
- **THEN** the system shows the failure to staff, keeps any earlier enrichment, and changes no service field

### Requirement: Credentials stay on the server
The system SHALL send requests to the enrichment service only from the server, and SHALL NOT expose its token or address to the browser.

#### Scenario: Browser inspects traffic
- **WHEN** a browser loads any page or calls any finder API
- **THEN** no response contains the enrichment token or address

### Requirement: Checklist facts overwrite service fields
The system SHALL automatically apply enriched facts for the checklist topics (cost, session times, eligibility, accessibility, contact details, location) to the matching service fields, without altering the stored catalogue record.

#### Scenario: Cost found
- **WHEN** an enrichment result contains a cost fact for a service whose cost differs
- **THEN** the service displays the enriched cost, and the catalogue's original cost is unchanged underneath

#### Scenario: Catalogue rebuilt
- **WHEN** the catalogue is rebuilt from source
- **THEN** existing enrichment overwrites are still applied to the rebuilt records

#### Scenario: Staff correction is newer
- **WHEN** a staff-verified correction for a field is newer than the enrichment overwrite
- **THEN** the staff correction is displayed

### Requirement: Overwrites keep provenance and can be reverted
The system SHALL record, for each overwritten field, the original value, the new value, the source URL, the supporting quote and the time, and SHALL let staff revert each overwrite individually.

#### Scenario: Staff revert
- **WHEN** staff revert an overwritten field
- **THEN** the service shows the original value again, and a later enrichment does not reapply that same value

#### Scenario: Refresh brings a different value
- **WHEN** staff re-enrich a service and a reverted field now has a different value
- **THEN** the new value is applied and recorded as a new overwrite

### Requirement: Enriched details are merged into the service details
The system SHALL show enriched details in the About this service section, one field per full-width row, using the enriched value where a standard field has one and adding every other fact as a labelled row. A fact already shown in a standard field SHALL NOT be listed again, and fact text SHALL be included in the service's searchable text.

#### Scenario: Standard field enriched
- **WHEN** an enrichment result replaces a service's cost
- **THEN** the cost row shows the enriched value, and no second cost row is shown

#### Scenario: Unexpected key
- **WHEN** the result contains a fact keyed `session_balanceability` that answers no standard field
- **THEN** the About section shows a row labelled from that key with its value

#### Scenario: Contact enriched
- **WHEN** an enrichment result replaces a service's primary phone number or email address
- **THEN** the Published contacts section shows the enriched value and, to staff, the original value with an undo

#### Scenario: Reverted field
- **WHEN** staff revert an overwritten field
- **THEN** the field shows its original value and the fact that was overwritten it appears as its own row

#### Scenario: Search finds enriched text
- **WHEN** a user searches for words that appear only in an enriched fact or passage
- **THEN** the service is returned

#### Scenario: Fact has ended
- **WHEN** a fact's validity period has ended
- **THEN** its row is marked as out of date

### Requirement: Enriched text is rendered as safe markdown
The system SHALL render enriched text as markdown, and SHALL NOT render raw HTML or images from it, and SHALL open only http and https links, in a new tab.

#### Scenario: Markdown list
- **WHEN** an enriched value contains a markdown list
- **THEN** it is shown as a list

#### Scenario: Script in the text
- **WHEN** an enriched value contains HTML such as a script tag
- **THEN** it is not rendered or executed

### Requirement: Enrichment is visible and reversible for staff
The system SHALL show staff when a service was last enriched with each overwrite and an Undo control, and SHALL give staff a "Recently enriched" list of overwrites with original value, new value, source and an undo control.

#### Scenario: Staff review overwrites
- **WHEN** staff open the Recently enriched list
- **THEN** each overwrite is listed newest first with its source and undo control

### Requirement: Gaps are counted for staff
The system SHALL show staff how many gaps the enrichment service could not close, with their topics available on hover and to assistive technology.

#### Scenario: Gap flagged for a person
- **WHEN** a result contains a gap marked as needing a person
- **THEN** the staff block shows a gap count and its topics

### Requirement: Unidentified services change nothing
The system SHALL store an `ambiguous`, `not_found` or `partial`-without-facts outcome and show it to staff, and SHALL NOT change any field, fact or search text because of it.

#### Scenario: Ambiguous
- **WHEN** the result is ambiguous
- **THEN** staff are told the service could not be identified and nothing was changed

#### Scenario: Not found
- **WHEN** the result is not found
- **THEN** the service is unchanged and staff see the outcome
