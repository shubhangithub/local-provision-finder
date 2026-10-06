# Spec Delta

## Purpose

Lets staff arrange a follow-up call to a customer at the end of a meeting, about the services the customer chose, and place that call on demand, so what the customer reports comes back for staff review.

## ADDED Requirements

### Requirement: Ask for follow-up details when a meeting ends
The system SHALL offer, when a staff meeting ends, to arrange a follow-up call by taking the customer's phone number, an optional first name, and a confirmation that the customer agreed to the call, and SHALL let staff skip it.

#### Scenario: Customer agrees
- **WHEN** a meeting ends and staff enter a valid phone number and confirm the customer agreed
- **THEN** a follow-up is scheduled and the screen confirms it, naming the services it will ask about

#### Scenario: Skipped
- **WHEN** staff skip the follow-up offer
- **THEN** no follow-up is stored and nothing else changes

#### Scenario: Missing confirmation or number
- **WHEN** staff submit a number without the agreement confirmation, or the confirmation without a valid number
- **THEN** the system rejects the request with a message and stores nothing

### Requirement: The call is about the services the customer chose
The system SHALL base the follow-up on the services the customer ticked during the meeting, at most five, and SHALL NOT offer a follow-up when none were ticked.

#### Scenario: Services ticked
- **WHEN** the customer ticked three services
- **THEN** the follow-up lists those three services and the call asks about each

#### Scenario: Nothing ticked
- **WHEN** no service was ticked
- **THEN** the offer explains that there is nothing to follow up and takes no details

### Requirement: Follow-ups page for staff
The system SHALL provide a Follow-ups page, reachable from the Staff menu, that lists every follow-up with the customer's first name, the services, a "scheduled in about a week" label and its status, and SHALL NOT show the phone number.

#### Scenario: Listing
- **WHEN** staff open the Follow-ups page
- **THEN** each follow-up is shown with its first name (or "Customer" when none), services and status, newest first

#### Scenario: Empty
- **WHEN** there are no follow-ups
- **THEN** the page says so and explains that follow-ups are arranged at the end of a meeting

### Requirement: Staff can place the call on demand
The system SHALL let staff place a scheduled follow-up call immediately, and SHALL NOT place any call automatically when the week passes.

#### Scenario: Follow up now
- **WHEN** staff press Follow up now on a scheduled follow-up
- **THEN** the system asks the call service to call, attesting the customer's agreement, and shows the follow-up as in progress

#### Scenario: Already placed
- **WHEN** a follow-up's call has already been placed
- **THEN** the button is not offered again, and the outcome is shown

#### Scenario: Call refused or not answered
- **WHEN** the call service refuses the call, or nobody answers
- **THEN** staff see the reason and can try again

#### Scenario: Not configured
- **WHEN** the call service is not configured
- **THEN** the button is disabled and says why

### Requirement: Calls are sandbox only
The system SHALL treat every follow-up call as a sandbox demo and SHALL say so wherever a call is offered or reported.

#### Scenario: Demo label
- **WHEN** a follow-up is shown
- **THEN** it is labelled as a sandbox demo that does not call the customer's number

### Requirement: Findings become pending reports
The system SHALL turn each finding from the call about a service (closed, moved, or a changed detail) into a pending service report quoting what the customer said, and SHALL NOT change any service because of it.

#### Scenario: Customer says a service closed
- **WHEN** the call finds one of the services closed
- **THEN** a pending report is created for that service with the customer's quote, ready to Apply or Dismiss

#### Scenario: Several services
- **WHEN** the call reports findings about two of the three services
- **THEN** one pending report is created for each of the two, and none for the third

#### Scenario: Nothing to report
- **WHEN** the call ends with no findings, someone else answers, or the customer declines
- **THEN** no report is created

### Requirement: Contact details are protected
The system SHALL keep the customer's phone number only for staff use, SHALL NOT include it in any list or response, and SHALL delete it once the follow-up completes or after a retention period.

#### Scenario: Lists
- **WHEN** the Follow-ups page or any API list is requested
- **THEN** no phone number appears

#### Scenario: Retention
- **WHEN** a follow-up completes, or its retention period passes without a call
- **THEN** the number is deleted and the follow-up record remains

### Requirement: The feedback form no longer takes follow-up details
The public feedback form SHALL NOT ask for a phone number or follow-up consent, and Service reports SHALL NOT show follow-up status or a call button.

#### Scenario: Feedback form
- **WHEN** a person leaves feedback on a service
- **THEN** the form has no phone number or follow-up field

#### Scenario: Service reports
- **WHEN** staff view Service reports
- **THEN** each report row shows only its report, with Apply, Dismiss or Review
