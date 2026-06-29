# prospects

[![Playwright](https://img.shields.io/badge/Playwright-45ba4b?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)

A job aggregation pipeline that consolidates career portals into a single deduplicated, stateful record. Parallel HTML scraping, REST JSON APIs, and authenticated sessions behind bot detection under a unified Page Object Model.

```bash
npm install
npx playwright install chromium
npx playwright test
```

Results populate `test-data/jobResults.json`. New postings are added on following runs; previously discovered jobs keep their status and notes.

---

## Architecture

Each platform has a dedicated page object exposing a consistent surface: `searchPage()`, `getJobs()`, and where supported, `jobDetails()`. Tests are thin; they pick a provider, iterate the configured sites, and hand results to the deduplication layer.

```
prospects/
├── pages/
│   ├── dom-pages/               # Archived DOM pages
│   ├── adp.ts                   # ADP
│   ├── applitrack.ts            # Applitrack
│   ├── atjSearch.ts             # ApplyToJob
│   ├── schoolspring.ts          # SchoolSpring (API)
│   ├── eightfold.ts             # Eightfold tenants (API)
│   ├── bisd.ts                  # Authenticated Eightfold (API)
│   ├── greenhouse.ts            # Greenhouse (API)
│   ├── ashby.ts                 # Ashby (API)
│   ├── lever.ts                 # Lever (API)
│   ├── smartrecruiters.ts       # SmartRecruiters (API)
│   ├── recruitee.ts             # Recruitee (API)
│   └── localRecruiters/r001/    # Recruiter-specific search
├── tests/
│   ├── dom-tests/               # Archived DOM tests
│   ├── adp.spec.ts
│   ├── applitrack.spec.ts
│   ├── atj.spec.ts
│   ├── schoolspring.spec.ts
│   ├── eightfold.spec.ts
│   ├── bisd.spec.ts             # serial, CDP-gated
│   ├── greenhouse.spec.ts
│   ├── ashby.spec.ts
│   ├── lever.spec.ts
│   ├── smartrecruiters.spec.ts
│   ├── recruitee.spec.ts
│   ├── r001.spec.ts
│   └── uaWebdriver.spec.ts      # fingerprint validation
├── classes/
│   ├── utilities.ts             # job types, dedup, batch writes, site registry
│   ├── specialContextPage.ts    # CDP attach + navigator.webdriver patch
│   └── cdpValidator.ts          # CDP port health, Chrome auto-launch
├── fixtures/
│   ├── dom-fixtures/            # Archived DOM fixtures
│   └── bisd-auth.ts             # cached login session + CDP context, worker scoped
├── test-data/                   # checked out from keithsecond/prospects-data
│   ├── sites.json               # all configured employers
│   ├── filters.json             # per-tenant Eightfold query params
│   ├── jobResults.json          # persistent results store
│   └── description/             # per-org enriched job details
├── bridge-to-career-ops.mjs
├── playwright.config.ts
└── globalTeardown.ts
```

> **Note:** `test-data/` is the private sibling repo [`keithsecond/prospects-data`](https://github.com/keithsecond/prospects-data), checked out as a subdirectory by CI. It is not committed to this repo.

---

## Three integration shapes

**DOM scraping (Applitrack, ATJ).** Resilient locators against rendered pages. Applitrack and SchoolSpring detect the "no relevant categories" case and skip the site cleanly rather than failing the run.

**Public JSON (Eightfold AI, SchoolSpring, ADP, Greenhouse, Ashby, Lever, SmartRecruiters, Recruitee).** The `Eightfold` page object constructs queries against `/api/pcsx/search`, paginates by `start` offset until `totalCount` is reached, then fetches `/api/pcsx/position_details` for each result. Per-tenant configuration — subdomain, domain, filter parameters — stored in `test-data/filters.json`. `Greenhouse`, `Ashby`, `Lever`, `SmartRecruiters`, and `Recruitee` follow the same shape against each platform's public job-board API, with the company/board slug parsed directly out of the configured `URL`: `Greenhouse` (`boards-api.greenhouse.io`) and `SmartRecruiters` (`api.smartrecruiters.com`) require a per-job detail request; `Ashby`, `Lever`, and `Recruitee` ship the full description inline in the listing payload, so `jobDetails()` re-fetches that same listing and filters it down rather than issuing per-job requests.

**Authenticated JSON (BISD via Eightfold).** Same API family, behind a login wall and bot detection. Handled separately because the auth model and execution mode differ.

---

## CDP

BISD's career portal sits behind an Eightfold tenant with light, but active, automation detection. Authentication and a running Chrome process via the Chrome DevTools Protocol allows access.

`CDPValidator.isUnavailable()` checks whether CDP is available via port check and JSON check. If unavailable, a Chrome Debug respawn is attempted and the JSON endpoint is retried. Upon further failure, the BISD suite skips with `testInfo.skip()`.

`SpecialContextPage` exposes two modes:

- `cdpBrowser()` — attaches to the live Chrome instance and uses the persistent context inside it
- `noNavigator()` — for lighter detection, creates a fresh context and patches `navigator.webdriver` out of the prototype chain at `addInitScript` time

The BISD fixture (`fixtures/bisd-auth.ts`) caches the authenticated session at worker scope, so all tests in the bisd spec reuse the same login and run serially.

---

## DOM to API migration

Providers initially used DOM scraping for resilience. Discovery of public APIs (SchoolSpring, BISD/Eightfold) showed 20–30x speed improvements with no reliability tradeoff. DOM implementations are archived in `pages/dom-pages/`, `fixtures/dom-fixtures/`, and `tests/dom-tests/`, and excluded via `testIgnore: '**/dom-tests/**'` in `playwright.config.ts`.

---

## Parallel execution without file contention

Concurrent provider runs are batched via `batchAppendJobs(siteId, jobs)` in `test-data/.batch/<org>.json`. `globalTeardown` runs `consolidateBatchWrites()`: it reads the batch files, consolidates them into the main store with ID-level deduplication, and removes the batch directory.

---

## Stateful job tracking

`jobResults.json` is the persistent store for all discovered postings across all orgs:

```json
{
  "Juniper ISD": {
    "Site": "Juniper ISD",
    "URL": "https://apply.juniper.org",
    "jobs": [
      {
        "id": "JOB123",
        "title": "Network Engineer",
        "link": "https://apply.juniper.org/careers/job/JOB123",
        "status": "0",
        "date": "2026-05-13",
        "notes": ""
      }
    ]
  }
}
```

Most tests accumulate only genuinely new IDs into an in-memory set, then write job details (department, location, work-site type, cleaned description) to `test-data/description/<org>.description.json`.

---

## Site registry

`test-data/sites.json` groups employers by provider type:

```json
{
  "Private": [
    {
      "id": "P001",
      "org": "Example Organization",
      "URL": "https://example.com/careers",
      "Provider": "ADP"
    }
  ]
}
```

Eightfold tenants are configured separately in `test-data/filters.json` with subdomain, domain, and per-tenant filter parameters.

---

## Running it

```bash
# everything, in parallel
npx playwright test

# one provider
npx playwright test tests/schoolspring.spec.ts

# CI mode: serial, retries, no forbidden test.only
CI=true npx playwright test

# custom keyword passed through the recruiter spec
SEARCH="network administrator" npx playwright test tests/r001.spec.ts

#  Job Description generation for eightfold client - https://example.eightfold.ai/careers/job/446718414598
JOBID="example,example.com,446718414598" npx playwright test tests/eightfold.spec.ts
```

---

## `bridge-to-career-ops.mjs`

Bridges scraped job descriptions from `test-data/` into [`keithsecond/career-ops`](https://github.com/keithsecond/career-ops) for AI-assisted evaluation. Runs with plain Node.js — no TypeScript toolchain required.

**Reads from `test-data/` (read-only)**
- `sites.json` + `filters.json` — reconstructs the `Utilities.ORGS` / `Utilities.URLS` lookup maps
- `jobResults.json` — identifies postings with `status: "0"` (new, not yet acted on)
- `description/<org>.description.json` — enriched JD text keyed by numeric entity ID

**Writes to `career-ops/`**
- `jds/<org-slug>-<entityId>.md` — cleaned, decoded job description ready for evaluation
- `data/pipeline.md` — appends `- [ ] local:jds/<file>.md | <Org> | <Title>` lines under `## Pending`
- `batch/batch-input.tsv` — rows for batch evaluation mode

**Writes back to `test-data/`**
- `.bridge-state.json` — idempotency ledger preventing re-bridging on subsequent runs
- `jobResults.json` — registers brand-new postings (in description files but absent from the tracker) with `status: "0"`

```bash
# Default — both repos checked out as siblings
node bridge-to-career-ops.mjs

# Dry run — compute and print everything, write nothing
node bridge-to-career-ops.mjs --dry-run

# Explicit paths
node bridge-to-career-ops.mjs \
  --prospects-root ~/code/prospects \
  --career-ops-root ~/code/career-ops

# Filter to one org, cap at 5 postings
node bridge-to-career-ops.mjs --org "Houston ISD" --limit 5

# Batch output mode
node bridge-to-career-ops.mjs --target batch

# Re-bridge everything (ignore state ledger)
node bridge-to-career-ops.mjs --reset-state
```

| Flag | Default | Description |
|---|---|---|
| `--prospects-root <dir>` | `.` | Path to this repo |
| `--career-ops-root <dir>` | `../career-ops` | Path to the career-ops repo |
| `--target <pipeline\|batch>` | `pipeline` | Output format |
| `--org "<name>"` | all | Only process this org (repeatable) |
| `--limit <n>` | unlimited | Cap postings bridged this run |
| `--dry-run` | false | Print plan, write nothing |
| `--no-update-job-results` | — | Skip back-filling `jobResults.json` |
| `--reset-state` | false | Ignore and overwrite the state ledger |

---

## CI/CD

Two `workflow_dispatch` workflows run on a self-hosted macOS runner:

- **`prospects-tests.yml`** — full test suite (all providers, parallel + CDP)
- **`cdp-tests.yml`** — CDP-only subset (uaWebdriver + BISD)

Both workflows:
1. Check out `prospects`, `keithsecond/headed-chrome-cdp-mac`, and `keithsecond/prospects-data` (as `test-data/`)
2. Build the headed Chrome CDP Docker image
3. Start XQuartz and launch the container with a host-mapped Chrome profile
4. Wait for the CDP endpoint on `127.0.0.1:9222`
5. Run `npx playwright test` (single invocation covering both parallel and CDP projects; `globalTeardown` consolidates batch writes at the end)
6. On success, commit and push updated `test-data/` back to `prospects-data` — with rebase-and-retry on push conflicts
7. Upload screenshots and Playwright reports as workflow artifacts (14-day retention)

A concurrency lock (`cancel-in-progress: false`) ensures only one run executes at a time, preventing data store conflicts.
