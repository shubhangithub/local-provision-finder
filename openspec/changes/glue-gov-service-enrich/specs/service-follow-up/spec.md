# Spec Delta

## Purpose

Lets a person who reported on a service agree to a follow-up call, lets staff trigger that call, and routes what the person says into the existing staff review of service reports.

## ADDED Requirements

### Requirement: Optional follow-up consent on feedback
The system SHALL let a person optionally give a phone number and tick a consent box when submitting feedback, and SHALL accept feedback without either.

#### Scenario: Consent given
- **WHEN** a person enters a valid phone number and ticks consent
- **THEN** the feedback is saved and the number and consent are stored separately from the report

#### Scenario: Number without consent
- **WHEN** a person enters a number but does not tick consent
- **THEN** the system rejects the submission with a message and stores nothing

#### Scenario: Not offered
- **WHEN** a person leaves both blank
- **THEN** the feedback is saved normally with no follow-up

### Requirement: Phone numbers are protected
The system SHALL expose a stored phone number only to staff, SHALL NOT include it in the feedback list or in any response to the public, and SHALL delete it after the follow-up is completed or after a retention period.

#### Scenario: Public feedback list
- **WHEN** the feedback list is requested without staff access
- **THEN** no phone number is present

#### Scenario: Retention
- **WHEN** a follow-up has finished, or its retention period has passed
- **THEN** the stored number is deleted and the report remains

### Requirement: Staff trigger follow-up calls
The system SHALL show, on each report that has follow-up consent, the status "Follow-up scheduled in 1 week", and SHALL let staff place the follow-up call immediately. The status is a label only; the system SHALL NOT call anyone automatically.

#### Scenario: Staff follow up now
- **WHEN** staff click Follow up now on a consenting report
- **THEN** the system asks the follow-up service to call, attesting the consent, and shows the follow-up as in progress

#### Scenario: No consent
- **WHEN** a report has no follow-up consent
- **THEN** it has no follow-up status and no Follow up now control

#### Scenario: Already followed up
- **WHEN** a report's follow-up has already been placed
- **THEN** the control is not offered again

#### Scenario: Follow-up service refuses
- **WHEN** the service denies the call (for example do-not-contact, cooldown or outside hours)
- **THEN** staff see the reason and the report stays unchanged

### Requirement: Calls are sandbox only
The system SHALL treat every follow-up call as a sandbox call, and SHALL say so wherever it offers or reports a call.

#### Scenario: Staff view a call
- **WHEN** a follow-up is offered or shown
- **THEN** it is labelled as a sandbox demo that does not call the person's number

### Requirement: Call findings become pending reports
The system SHALL turn each finding from a follow-up call about a service (closed, moved, or a changed detail) into a pending service report quoting what the person said, and SHALL NOT change any service field because of it.

#### Scenario: Person says the service closed
- **WHEN** a call finds a service closed permanently
- **THEN** a pending report is created for that service with availability closed and the person's quote

#### Scenario: Price changed
- **WHEN** a call finds a changed price
- **THEN** a pending report is created flagging the cost, with the quote

#### Scenario: Nothing to report
- **WHEN** a call ends with no findings about the service
- **THEN** no report is created

#### Scenario: Wrong person or declined
- **WHEN** someone else answers or the person declines
- **THEN** no findings are recorded
