The application includes the directory agent, staff sign-in and editable customer summary exports, backed by the shared directory APIs and live meeting implementation.

# Local Provision Finder

React and TypeScript support finder with GOV.UK styling, compact cards and real local directory data.

## Run locally

Requires Node.js 22.13 or newer.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:8000. Without system Node, use `./scripts/dev.sh`.

Data is deliberately excluded from Git, including database files and exports. On this machine, compressed backups are in `~/Downloads/local-provision-data`; development restores them automatically if needed. Set `DWP_SNAPSHOT_DIR` to use another local backup directory. Without a backup, run `npm run ingest`, then `npm run index:semantic`. Model weights are downloaded once and cached locally.

## Working flows

- Search everyday language using local semantic embeddings and keyword matching. No OpenAI API key is required; directory text stays local during embedding.
- Choose a town, postcode, current location or map area. Pan and zoom the results map to search its visible area, automatically or with the search button.
- View published service contacts, save services and print a shortlist.
- Submit service feedback; staff review evidence and publish individual checked corrections without changing original source assurance dates.
- Suggest a service; staff prepare an ingestion draft, fetch public website text and contacts, review evidence, then publish to search.
- Staff add persistent service tags. Matching tags rank first and appear on result cards.
- General notifications include saved-service updates, feedback prompts and staff queues.
- Staff start a ten-minute meeting on one shared microphone: microphone permission, a clear notice that audio is sent to Azure OpenAI, live transcription with a waveform, live topic tracking that searches the directory as people talk (ticks save to the shortlist, crosses hide a suggestion), Stop, a printable next-steps report and a local recording download. Recording stops when the meeting ends or staff leave the homepage or staff mode.

Staff sign-in is a local demo toggle, not production authentication. Local API routes require loopback access and validate writes. Production hosting needs a backend, real authentication and network controls for website fetching. Static `dist/` alone does not provide the database API. During a meeting, microphone audio is streamed from the local server to the Azure OpenAI (or OpenAI) Realtime API for transcription and topic tracking. This app does not store the audio; the optional recording download stays in the browser. The transcript is machine-generated and may contain mistakes. Tell everyone in the room before starting.

## OpenAI assistance

The server uses the Responses API with read-only directory tools and structured outputs. Publication remains a staff decision. Agent search questions respect the selected location or map bounds. Service questions use retained source evidence; suggested-service review checks duplicates and proposes details/tags; feedback review proposes checks; staff tag suggestions remain unsaved until accepted; meeting summaries use the displayed transcript and selected area.

Copy `.env.example` to `.env` and set `OPENAI_API_KEY`. The default model is `gpt-4.1-mini`; change `OPENAI_MODEL` on the server to use another compatible model. Live meetings use Azure OpenAI when `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_API_KEY` are set (`AZURE_OPENAI_DEPLOYMENT` names the realtime deployment, `AZURE_OPENAI_FILTER_DEPLOYMENT` the small model that trims candidate services), otherwise OpenAI (`OPENAI_REALTIME_MODEL`, `OPENAI_TRANSCRIBE_MODEL`, `OPENAI_FILTER_MODEL`). The existing assistant still uses `OPENAI_API_KEY`. The key stays on the backend, and `.env` is excluded from Git. The API reads local configuration on each request. Local checks remain available when no key is configured or OpenAI is unavailable.

Search results come straight from the directory with no AI summary; other assistance uses explicit buttons. Map movement does not trigger paid calls. Requests have bounded tool steps, response sizes, concurrency and rate limits. OpenAI receives relevant directory excerpts and the question/report or displayed meeting transcript for that task; the full database is not uploaded. Meeting audio is sent only to the Realtime API during a meeting. API response storage is disabled with `store: false` (this does not claim zero retention under all provider policies). Service claims with invented IDs or unmatched source quotes are omitted; quote matching is not an independent fact check. Staff must review evidence before changing or publishing records. Staff mode remains a local demo toggle, not authentication.

## Data

The cleaned catalogue contains **5,085 services**: Bristol 862, Kingston 351 and Buckinghamshire 3,872. All 5,101 original records remain archived locally, with retained text, source provenance and published charity contacts. Missing coordinates are identified rather than invented. Source assurance and update dates remain separate; old assurance dates are preserved.

The single CSV is `data/local-provision-services.csv`, also copied to Downloads. Min/max age and computed confidence columns are excluded. Matching names/providers are consolidated while retaining contacts, locations, descriptions and original source IDs. Staff feedback, tags and suggestions use separate local SQLite stores. Original synthetic workbook examples remain available only at `/#/demo`.

```sh
npm run ingest                 # cached source imports and consolidation
npm run ingest -- --refresh    # re-fetch sources
npm run export:csv             # regenerate combined CSV
npm run index:semantic         # build/update local vector index
npm run snapshot:data          # compressed local backups
npm run audit:data             # data quality reports
```

See [ingestion documentation](docs/ingestion.md) for source details.

## Checks

```sh
npm run check
npm run test:ingest
npx playwright install chromium
npm run test:e2e
```

Browser tests cover desktop/mobile searches, maps, feedback, suggestions, tags, notifications and meeting controls, alongside automated accessibility checks. These checks do not replace a manual accessibility audit.

## Urgency and search suggestions

The search box offers real directory service names after three characters, using the existing semantic index with a 350 ms debounce. Suggestions respect selected location/map bounds and never require a paid model call. If semantic search is unavailable, directory keyword matches are used. Arrow keys select an option; Enter searches it; Escape dismisses suggestions.

Clear current urgency phrases activate the optional Help today preference. Users can turn it off or enable it themselves. Matching urgent services move higher in results; closed services and location boundaries are still respected. A badge requires explicit affirmative urgency wording in a service name, description, category or tag. It does not claim current opening or availability. Live meetings show the same urgency prompt and prioritise recorded urgent services within each relevance-filtered topic; the meeting AI summary receives the staff preference.

Detection uses transparent phrase rules, with common negation and historical clauses suppressed. It is not a comprehensive safety assessment. Clear danger signals show NHS emergency guidance immediately, independently of AI availability or location selection. Guidance sources: https://www.nhs.uk/nhs-services/mental-health-services/where-to-get-urgent-help-for-mental-health/ and https://www.gov.uk/homelessness-help-from-council .

## Web enrichment and follow-up calls

Staff can enrich a service from the open web and ask for sandbox follow-up calls, both through the separate gov-service-enrich service. Set `GOV_HACK_URL` (its base address) and `GOV_HACK_API_TOKEN` (its bearer token) in `.env`. They are read on the server for each request and never sent to the browser. Without them the Enrich and Follow up buttons are disabled and say why.

- **Enrich service profile** (staff, button above Published contacts on a service's details): the service's facts overwrite the matching fields (cost, opening times, eligibility, accessibility, contact details, address, how to book). The original value, source and quote are kept, and each overwrite can be undone there or from **Enrichment log** in the staff menu. The details appear in **About this service**: standard fields with enriched values, and every other fact as an extra row, with the source recorded for staff. Enriched text renders as markdown without HTML, and all of it is searchable. A staff-verified correction newer than an overwrite always wins. This is the one place unreviewed content changes a published field; the recorded source and the undo are the safeguards.
- **Follow-up**: the feedback form can ask for a phone number and consent. The number is stored apart from the report (`data/follow-ups.sqlite`), shown only to staff, and deleted after the follow-up or 30 days. "Follow-up scheduled in 1 week" is a label: staff press **Follow up now** to place a call. Calls are sandbox-only and never reach the person's number. Anything the person reports becomes a pending service report for review, and never changes a record by itself.

## Layout

Pages share one frame, two width variants, two grids and three breakpoints. See [docs/layout.md](docs/layout.md) before adding a page or changing widths.
