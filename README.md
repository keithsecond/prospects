# Prospects

[![Playwright](https://img.shields.io/badge/Playwright-45ba4b?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)

A job aggregation pipeline that consolidates career portals into a single deduplicated, stateful record. Parallel HTML scraping, REST JSON APIs, and authenticated sessions behind bot detection under a unified Page Object Model.

```
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
│   └── localRecruiters/r001/    # Recruiter-specific search
├── tests/
│   ├── dom-tests/               # Archived DOM tests
│   ├── adp.spec.ts
│   ├── applitrack.spec.ts
│   ├── atj.spec.ts
│   ├── schoolspring.spec.ts
│   ├── eightfold.spec.ts
│   ├── bisd.spec.ts             # serial, CDP-gated
│   ├── r001.spec.ts
│   └── uaWebdriver.spec.ts      # fingerprint validation
├── classes/
│   ├── utilities.ts             # job types, dedup, batch writes, site registry
│   ├── specialContextPage.ts    # CDP attach + navigator.webdriver patch
│   └── cdpValidator.ts          # CDP port health, Chrome auto-launch
├── fixtures/
│   ├── dom-fixtures/            # Archived DOM fixtures
│   └── bisd-auth.ts             # cached login session + CDP context
├── test-data/
│   ├── sites.json               # all configured employers
│   ├── filters.json             # per-tenant Eightfold query params
│   ├── jobResults.json          # persistent results store
│   └── description/             # per-org enriched job details
├── playwright.config.ts
└── globalTeardown.ts
```

---

## Parallel execution without file contention

Concurrent provider runs are batched via `batchAppendJobs(siteId, jobs)` in `test-data/.batch/<org>.json`. `globalTeardown` runs `consolidateBatchWrites()`: it reads the batch file, consolidates them into the main store with ID-level deduplication, and removes the batch directory.

The result is order-independent and concurrency-safe.

---

## Three integration shapes

**DOM scraping (Applitrack, ATJ).** Resilient locators against rendered pages. Applitrack and SchoolSpring detect the "no relevant categories" case and skip the site cleanly rather than failing the run.

**Public JSON (Eightfold AI, SchoolSpring, ADP).** The `Eightfold` page object constructs queries against `/api/pcsx/search`, paginates by `start` offset until `totalCount` is reached, then fetches `/api/pcsx/position_details` for each result. Per-tenant configuration — subdomain, domain, filter parameters — stored in `test-data/filters.json`.

**Authenticated JSON (BISD via Eightfold).** Same API family, behind a login wall and bot detection. Handled separately because the auth model and execution mode differ.

---

## CDP

BISD's career portal sits behind an Eightfold tenant with light, but active, automation detection. Authentication and a running Chrome process via the Chrome DevTools Protocol allows access.

`CDPValidator.isUnavailable()` checks whether CDP is available via port check and json check. If unavailable, a Chrome Debug respawn is attempted and the JSON endpoint is retried. Upon further failure, the BISD suite skips with `testInfo.skip()`.

`SpecialContextPage` exposes two modes:

- `cdpBrowser()` — attaches to the live Chrome instance and creates an isolated context inside it
- `noNavigator()` — for lighter detection, creates a fresh context and patches `navigator.webdriver` out of the prototype chain at `addInitScript` time

The BISD fixture (`fixtures/bisd-auth.ts`) caches the authenticated session at module scope, so all tests in the suite reuse the same login and run serially.

---

## DOM to API Migration:

Providers initially used DOM scraping for resilience. Discovery of public APIs (SchoolSpring, BISD/Eightfold) showed 20-30x speed improvements with no reliability tradeoff.

DOM implementations are archived in pages/dom-pages/, fixtures/dom-fixtures, and tests/dom-tests/ and excluded via `testIgnore: '**/dom-tests/**' in playwright.config.ts`

---

## Stateful job tracking

`jobResults.json`

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

Most tests accumulates only genuinely new IDs into an in-memory set, then writes job details (department, location, work-site type, cleaned description) to `test-data/description/<org>.description.json`.

---

## What's in the registry

`test-data/sites.json` example:
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

---

## Running it

```bash
# everything, in parallel
npx playwright test

# one provider
npx playwright test tests/schoolspring.spec.ts

# CI mode: serial, retries, no forbidden test.only
CI=true npx playwright test

# custom keyword pass through the recruiter spec
SEARCH="network administrator" npx playwright test tests/r001.spec.ts
```

BISD requires credentials in `.auth/.env`:

```
BISD_EMAIL=...
BISD_PASSWORD=...
```

---

## In progress

- [x] GitHub Actions workflow with a [containerized Chrome](https://github.com/keithsecond/headed-chrome-cdp-mac) for the CDP-gated suites — the current implementation assumes a local macOS Chrome path
- Bridge `jobResults.json` and `<org>.description.json` with [career-ops](https://github.com/santifer/career-ops)

Companion projects: 
- [headed-chrome-cdp-mac](https://github.com/keithsecond/headed-chrome-cdp-mac), a Dockerfile and support scripts for headed Chrome CDP on macOS
- [vibe-tracker](https://github.com/keithsecond/vibe-tracker), a web dashboard over the `jobResults.json` produced by this pipeline.
