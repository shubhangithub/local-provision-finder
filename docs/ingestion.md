# Internal service ingestion

Run with Node 22.23 or later (built-in `node:sqlite` is experimental in Node 22):

```sh
npm run ingest
npm run ingest -- --source=bristol-oruk
npm run ingest -- --refresh --source=bristol-oruk
npm run test:ingest
```

The default run imports Bristol and Kingston upon Thames. Kingston reuse was approved by the user on 5 October 2026 for this project; the adapter records that project permission rather than asserting a general open-data licence. It does not substitute Hull. Unknown source names and unknown arguments fail. No dependencies beyond Node are required.

## Outputs and access

- `data/services.sqlite`: keyed service records, indexed postcode/coordinates, indexed needs relation, `ingest_runs` log. Each service has a `search_text` column for questions beyond the structured fields and `record_json` with all retained source information.
- `data/services.internal.json`: complete normalized export with contact channels, `searchText`, `textProvenance`, and retained source JSON.
- `data/ingest-report.json`: exact fetched/written/skipped/removed counts plus need totals and postcode/assurance coverage.
- `data/ingest-cache/`: API response cache with original fetch timestamps. This cache is local and ignored by Git.

Imported records start `internal`. A rerun preserves an existing human approval. These exports are **not frontend assets**: do not import them into `src` or put them under `public`. Use an authenticated backend and a deliberate approved-field projection before serving real records. The local staff workspace now provides a read-only, loopback-only database browser at Staff sign in → Review → Imported services. It searches search_text and displays retained source details and published contacts. This demo toggle is not authentication; production access and publication require a real authenticated backend. Public search remains on the separate fictional dataset.

## Sources and licensing checked 5 October 2026

**Bristol City Council / Well Aware**, including South Gloucestershire: [ORUK v3 root](https://bristol.openplace.directory/o/OpenReferralService/v3). Live listing reported **874** records. The root reports HSDS-UK-3.0 and links the [HSDS 3.0 OpenAPI schema](https://raw.githubusercontent.com/openreferral/specification/3.0/schema/openapi.json). [Well Aware directory account terms](https://www.wellaware.org.uk/terms-and-conditions-open-place-directory-account/) explicitly state the directory information is published as open data and available under the Open Government Licence. The terms do not identify an OGL version. Attribution: contains service directory information from Bristol City Council / Well Aware, licensed under the Open Government Licence. Do not imply council endorsement.

**Kingston upon Thames / Connected Kingston**: API at [services](https://api.connectedkingston.uk/core/v1/services), with 354 records. The user confirmed approval to reuse Kingston data on 5 October 2026; ingestion is enabled for this project. This is project-specific permission, not a claim that the source publishes under a general open licence. Original [terms](https://connectedkingston.uk/terms-and-conditions) are retained for reference. Related public organisation and service-location records are fetched too, including names, published contacts, addresses, access facilities and opening hours. The unfiltered service-location API sorts nullable names and was observed returning duplicate IDs across pages; the adapter instead retrieves each service's complete filtered location set with nested locations, checking totals and identity.

## Fidelity, free text and contacts

Fetch **every detail endpoint**, not only summaries. Raw retains both `_sourceList` and `_sourceDetail` records, with the combined source record as a convenience. The local cache retains each complete public API envelope and its actual network fetch timestamp. Original description HTML stays in raw; normalized descriptions and `searchText` remove markup and script contents. `searchText` includes broadly gathered leaf text from every retained service field, descriptions, organization details, locations, schedules, fees, eligibility, taxonomy, access notes, source extensions and contacts. `textProvenance` records which fields contributed, source record URL and fetch time. Machine IDs are excluded from the searchable prose while remaining in raw.

Published charity/service contacts are preserved, including named professional contacts, personal-form professional email addresses and mobile numbers explicitly listed as service contacts. `contacts` keeps original contact fields and adds source URL and fetched date. Generic private administrative audit fields (assurer email, account IDs/usernames, tokens/credentials) are excluded; source assurance dates are retained. Contact preservation follows the user's explicit instruction and overrides the earlier handoff's blanket exclusion of names/mobile numbers. No arbitrary third-party provider websites are scraped: their independent reuse permissions have not been established. This retains all permissible API description detail without claiming comprehensive knowledge of every provider website.

The Bristol feed actually uses `location.addresses`, nested `regular_schedule`, `cost_options` and sometimes string `attending_type`; normalization handles these alongside HSDS alternatives. All locations remain in raw/search text; the first location represents structured postcode/address. A 0,0 coordinate is treated as missing. An online service remains locally scoped unless the source explicitly indicates national reach. Taxonomy terms remain verbatim when supplied; keyword need mapping lives in `ingest/needs.ts` and is a heuristic, not eligibility evidence. Missing cost, delivery, opening times and contact channels are not invented. Placeholder invalid emails are omitted from normalized public channels but retained in raw.

## Assurance and repeatability

`lastVerified` is **only an explicit assurance date** (`assured_date` / `pc_metadata.date_assured`). Administrative updates are separate in `sourceUpdatedAt`. A recent edit cannot produce “Verified”. Status uses calendar six/twelve month boundaries; future assurance dates are treated as uncertain. Confidence is a hackathon heuristic, not a measured probability: 90 decaying to a floor of 30 over two years, missing/future date 40. Trust age is evaluated at execution time; cached fetch dates are not rewritten as fresh checks.

Stable IDs combine source ID and source record ID. Complete source results are staged in memory and upserted in one transaction; failures do not partially modify the catalogue or remove anything. Removal occurs only after an explicitly refreshed **complete** source pass. Cached reruns never infer removals. A source total mismatch, duplicate ID, changing total, incorrect page, empty intermediate page, HTTP error or detail identity mismatch fails loudly and is logged in `ingest_runs`. Failed runs retain existing service records. Pure job listings/employer records are excluded; employment support/training services remain in scope.

Requests are sequential, at least 510ms apart (under two per second), identified with a descriptive User-Agent and limited to 30 seconds each. Default reruns use disk cache; `--refresh` performs fresh requests. Cold Bristol fetch takes about eight minutes because full service details are retained.

## Validation

Contract tests cover three representative shapes per adapter; contract fixtures are synthetic; source records are preserved separately in the approved dataset. Additional live Bristol fixtures are retained under the Bristol OGL after the completed fetch. Tests cover contact preservation/private metadata exclusion, arbitrary detail retention in searchable prose, date semantics and boundaries, online locality, pagination count and identity failures, licence gating, cached fetch dates, source-isolated removals, transactional rollback, idempotent upsert and approval preservation.

See `data/ingest-report.json` for the generated counts and coverage of the completed dataset. Need counts overlap because a service can match multiple needs.

## Completed import counts

5 October 2026: **874 Bristol records**, 874/874 full detail endpoints fetched, 0 excluded as pure job listings, all 874 internal. Kingston: 354 full service records imported under user-confirmed project approval; related organisation/location enrichment is retained. SQLite integrity check: `ok`; cached rerun: 874 rows, no duplication, under one second.

257/874 records have a structured postcode (**29.4%**), 873/874 have an explicit source assurance date (**99.9%**), all 874 have an administrative updated date, 87 have non-placeholder structured coordinates. An assurance date's presence does not imply freshness; use the calculated status. 695 records have a normalized publicly listed phone channel and 622 a normalized email; full published contact objects and original channels remain retained. Every service has searchable free text (minimum 486 characters).

| Need | Matching services |
| --- | ---: |
| Skills and training | 188 |
| Mental health | 171 |
| Physical health | 129 |
| Childcare | 7 |
| Housing | 71 |
| Money and debt | 75 |
| Digital skills | 11 |
| Confidence | 77 |

## Cleaned combined catalogue

`npm run export:csv` writes one `data/local-provision-services.csv`: 862 Bristol and 351 Kingston listings after consolidating 15 repeated service-name/provider rows. All contacts, locations, differing descriptions and original source IDs/URLs are retained. Full original source records stay in `services.internal.json` and `services`; cleaned listings use `services.cleaned.json` and the SQLite `catalogue_services` table. Min/max age metadata, raw JSON, computed confidence and verification-status fields are excluded from the cleaned CSV. Original source dates remain intact; age alone is not an error in the quality audit. The database retains both the original 1,228 records and 1,213 cleaned listings.
