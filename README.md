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
- Staff start a ten-minute meeting demo: microphone permission, local recording, clearly labelled simulated word-by-word transcription, Stop and recording download. Recording stops when the meeting ends or staff leave the homepage or staff mode.

Staff sign-in is a local demo toggle, not production authentication. Local API routes require loopback access and validate writes. Production hosting needs a backend, real authentication and network controls for website fetching. Static `dist/` alone does not provide the database API. Microphone audio is not uploaded and the displayed transcript is simulated, not speech recognition.

## OpenAI assistance

The server uses the Responses API with read-only directory tools and structured outputs. Web discovery can enqueue drafts, while publication remains a staff decision. Search assistance respects the selected location or map bounds. Service questions use retained source evidence; suggested-service review checks duplicates and proposes details/tags; feedback review proposes checks; staff tag suggestions remain unsaved until accepted; meeting summaries use the displayed simulated transcript and selected area.

Copy `.env.example` to `.env` and set `OPENAI_API_KEY`. The default model is `gpt-4.1-mini`; change `OPENAI_MODEL` on the server to use another compatible model. The key stays on the backend, and `.env` is excluded from Git. The API reads local configuration on each request. Local checks remain available when no key is configured or OpenAI is unavailable.

A deliberate nonempty search automatically requests a short AI overview; other assistance uses explicit buttons. Map movement does not trigger paid calls. If alternative directory searches still find no matches, web discovery can create up to two source-backed provisional service cards and unreviewed staff drafts. Sources must appear in actual web-search results, pass the public-page fetch checks and contain the quoted service evidence. Pending drafts are deduplicated; rejected drafts are not redisplayed. Provisional cards are labelled as not yet reviewed and never enter the published catalogue automatically. Requests have bounded tool steps, response sizes, concurrency and rate limits. OpenAI receives relevant directory excerpts and the question/report or displayed meeting transcript for that task; the full database and microphone audio are not uploaded. API response storage is disabled with `store: false` (this does not claim zero retention under all provider policies). Service claims with invented IDs or unmatched source quotes are omitted; quote matching is not an independent fact check. Staff must review evidence before changing or publishing records. Staff mode remains a local demo toggle, not authentication.

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
