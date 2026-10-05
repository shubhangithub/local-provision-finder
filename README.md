# Local Provision Finder

A React and TypeScript DWP hackathon prototype for searching support, understanding information gaps, saving a shortlist and reviewing proposed changes. The interface follows the original GOV.UK-style mockup with compact mobile cards, plain headings, blue links, green buttons and yellow keyboard focus.

## Run locally

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:8000**. Requires Node.js 22.13 or newer (22.23.3 tested). The server binds to loopback only.

If Node.js is not installed:

```sh
./scripts/dev.sh
```

The launcher downloads a checksum-verified, project-local Node runtime; it does not change your system installation.

## Two catalogues

**Public search** uses the ten fictional services from the supplied DWP workbook, with demo postcode areas AB1–AB8. It matches needs, respects the supplied sample distances, excludes closed services and explains missing provision and conflicting information. Online delivery does not remove postcode coverage limits. Cost and hours are shown as unknown where the workbook supplies no values. No national records are invented. Synthetic publication approval is an explicit demo assumption.

**Staff → Review → Imported services** reads the local SQLite database through a read-only, loopback-only API. The database contains 874 Bristol Well Aware records and 354 Kingston records, retained source JSON, full searchable free text and published charity contacts. All imports are internal and do not enter public search. Kingston upon Thames is imported under project reuse approval confirmed by the user. See [ingestion documentation](docs/ingestion.md) for source terms, counts, schema and freshness rules.

A source assurance date and a source update date are separate. Neither the UI nor a recently fetched page guarantees current availability, suitability or eligibility.

## Working flows

- Search circumstances and postcode; optional topics, distance, delivery and access needs.
- View a service's checks, access route and source evidence.
- Save and print a shortlist. Saved IDs persist in this browser.
- Enter staff demo; publish a specifically checked change, reject it or hold it. Publishing one field preserves whole-record confidence and verification dates.
- Browse imported services and search their full source text; inspect their published contacts.

Staff sign-in is a demo toggle, not authentication. Review decisions persist locally; feedback stays in the browser session. No referrals, messaging, live maps, arbitrary-question AI or production permissions are implemented. Raw data is retained for future grounded question answering; full-text search is implemented now.

The imported catalogue API is supplied by the local Vite server and local preview server. A standalone static `dist/` deployment has no database API. The production browser bundle contains only fictional public records; imported source JSON and SQLite are never copied into `dist/`.

## Ingestion

```sh
npm run ingest                  # cached, idempotent upsert
npm run ingest -- --refresh      # re-fetch; mark vanished services after a complete successful run
```

Full imports take several minutes with a maximum of two requests per second. API failures do not partially publish a source or remove existing records. Published service contacts, source descriptions, list/detail objects and fetch provenance are preserved. Private audit metadata is excluded as documented in the source adapter.

Combined CSV export: `npm run export:csv` writes `data/local-provision-services.csv` (862 Bristol + 351 Kingston listings). `npm run clean:data` consolidates matching service names and providers while preserving all contacts, locations, descriptions and source IDs. Original API records remain archived in `services.internal.json` and the database `services` table; the local browser reads the cleaned `catalogue_services` table. Min/max age fields and computed confidence/status are excluded from the cleaned output. Old source assurance dates remain unchanged and are not treated as data errors. Quality audit: `npm run audit:data`; results are saved as `data/quality-audit.json` and `data/quality-issues.csv`.

## Checks

```sh
npm run check                   # matching/review tests + TypeScript + production build
npm run test:ingest              # normalisation, contact fidelity and database tests
npx playwright install chromium
npm run test:e2e                 # desktop/mobile journeys and automated WCAG checks
```

Automated accessibility checks cover the main pages and review dialog; they are not a full manual WCAG audit.

## Structure

```text
src/components/   Compact cards and imported-service browser
src/data/         Fictional workbook sheets and normalised catalogue
src/lib/          Matching, guarded updates and browser storage
server/           Read-only local imported-catalogue API
ingest/          Source adapters, normalisation, full text, SQLite upserts
data/            Populated SQLite, internal JSON export and ingestion report
tests/           Browser journeys and accessibility checks
```

The original self-contained design document is preserved at `/original-mockup.html`.
