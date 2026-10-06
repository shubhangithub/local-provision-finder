# Spec Delta

## Purpose

Makes a follow-up call's proposed changes read as neutral statements about a service instead of the caller's own words, while keeping the exact words as evidence.

## ADDED Requirements

### Requirement: Proposed values are neutral statements about the service
The system SHALL, when a finished call yields a proposed change, rewrite what the person said into one short third-person statement about the service, with no first-person wording, no "they said" framing and no reference to the person.

#### Scenario: Capacity said in the first person
- **WHEN** a person says a service is really busy and they will not be seen for a couple of weeks
- **THEN** the proposed capacity value is a neutral statement such as "Busy: about a 2-week wait", followed by the date the call was made

#### Scenario: A confirmed price
- **WHEN** a person confirms a price on the call
- **THEN** the proposed cost value states the price about the service, not what the person said

### Requirement: The exact words stay as evidence
The system SHALL keep the person's original quote unchanged in the report, shown to staff beside the proposed value, and SHALL NOT use the rewritten text in place of the quote.

#### Scenario: Reviewing a proposal
- **WHEN** staff open a report from a call
- **THEN** they see both the rewritten proposed value and the person's exact quote

### Requirement: A rewrite is only used when it is trustworthy
The system SHALL use a rewrite only if it is a short third-person statement about the same service. Otherwise, or when the language model is unavailable, fails or times out, the system SHALL still create the report but without a one-click proposal.

#### Scenario: Model unavailable
- **WHEN** no language model is configured or the request fails
- **THEN** the report is created with the person's words as evidence and no one-click Apply, so staff review and write the value

#### Scenario: Rewrite still in the first person
- **WHEN** the model returns text containing first-person wording or text over the length limit
- **THEN** the rewrite is discarded and the report has no one-click proposal

### Requirement: Nothing personal is sent to the model
The system SHALL send the model only the service name and the finding's text, and SHALL NOT send the phone number, the person's name, or any other contact detail.

#### Scenario: Request contents
- **WHEN** a finding is rewritten
- **THEN** the request contains the service name and the finding's words and nothing identifying the person

### Requirement: Nothing is applied automatically
The system SHALL leave every proposed change pending until staff apply or dismiss it, as before.

#### Scenario: Rewrite succeeds
- **WHEN** a rewrite is produced
- **THEN** the report is pending and the service page is unchanged until staff apply it
