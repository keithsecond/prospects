# PROSPECTS

[![Playwright](https://img.shields.io/badge/Playwright-45ba4b?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)

A Playwright/TypeScript automation framework for aggregating job listings across multiple employer platforms. Uses Page Object Model architecture, parallel test execution with race-condition-safe batch writes, CDP browser integration for bot-detection bypass, and stateful job tracking with deduplication.

---

## Features

- **Page Object Model (POM)**: Each job platform has its own typed page class with locators, navigation, and extraction logic cleanly separated from test specs
- **Parallel Execution**: All providers run simultaneously using all available CPU cores via Playwright's `fullyParallel` mode
- **Race-Condition-Safe Batch Writes**: Parallel tests write to isolated per-org batch files; a `globalTeardown` hook consolidates and deduplicates into a single `jobResults.json` after all tests complete
- **CDP Browser Integration**: Connects to a locally running Chrome Debug Protocol instance to bypass bot-detection on sites that flag headless browsers; gracefully degrades when CDP is unavailable
- **Webdriver Fingerprint Suppression**: `SpecialContextPage` patches `navigator.webdriver` at the browser context level for non-CDP sessions
- **Stateful Job Tracking**: `jobResults.json` persists across runs; new jobs are appended and deduplicated by job ID — previously found jobs retain their status and notes
- **Skip Logic**: SchoolSpring and Applitrack providers detect sites with no relevant job categories and skip cleanly rather than failing
- **Fixture-Based Auth**: BISD uses a custom Playwright fixture with session caching, CDP context, and `.env`-based credential injection
- **CI/CD Mode**: Switches to serial execution and retry logic when `CI=true`

---

## Project Structure

```
prospects/
├── tests/
│   ├── adpJobs.spec.ts
│   ├── atjJobs.spec.ts
│   ├── schoolspringJobs.spec.ts
│   ├── applitrackJobs.spec.ts
│   ├── bisd.spec.ts              # authenticated, CDP, serial
│   ├── R001Search.spec.ts
│   └── uaWebdriver.spec.ts       # CDP / UA fingerprint validation
├── pages/                        # Page Object Model classes
├── classes/                      # Helpers   
│   ├── utilities.ts              # Job types, batch writes, deduplication, site config
│   ├── specialContextPage.ts     # CDP and navigator.webdriver patching
│   └── cdpValidator.ts           # CDP port check and Chrome launcher
├── fixtures/
│   └── bisd-auth.ts              # BISD session caching + CDP auth
├── test-data/                    # .gitignore files
│   ├── sites.json                # All configured job search sites and URLs
│   ├── jobResults.json           # Persistent job results store
│   └── applied.json              # Application status tracking
├── playwright.config.ts
├── globalTeardown.ts             # Post-run batch consolidation
├── tsconfig.json
└── package.json
```

---

## Prerequisites

- Node.js 16+
- npm

For CDP features (BISD, webdriver fingerprint tests):
- Google Chrome installed at the default macOS path (`/Applications/Google Chrome.app`)

---

## Installation

```bash
npm install
npx playwright install chromium
```

Configure credentials for authenticated sites:

```bash
cp .auth/.env.example .auth/.env
# Edit .auth/.env and set BISD_EMAIL and BISD_PASSWORD
```

---

## Usage

### Run all providers in parallel

```bash
npx playwright test
```

### Run a specific provider

```bash
# Provider sites
npx playwright test tests/{provider}.spec.ts
```

### Custom keyword search (local recruiter)

```bash
export SEARCH="software engineer"
npx playwright test tests/R001Search.spec.ts
unset SEARCH
```

If `SEARCH` is not set, the recruiter spec defaults to an IT-category search.

### Validate CDP and webdriver fingerprint

```bash
npx playwright test tests/uaWebdriver.spec.ts --ui
```

Screenshots are saved to `test-data/screenshotNoNav.png` (navigator patch) and `test-data/screenshotCDP.png` (CDP session) for visual verification.

### CI/CD mode (serial, with retries)

```bash
CI=true npx playwright test
```

---

## Configuration

### Adding job sites

Edit `test-data/sites.json`. Sites are grouped by category and each entry requires `id`, `org`, `URL`, and `Provider`:

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

Supported `Provider` values: `ADP`, `ATJ`, `schoolspring`, `applitrack`, `bisd`, `r001`

### Adding a new provider

1. **Create a Page Object** in `pages/`:

```typescript
import { Page, Locator } from '@playwright/test';
import { Job, Utilities } from '@classes/utilities';

export class NewProvider {
    page: Page;
    utils: Utilities;
    id: string;
    // define locators...

    constructor(page: Page, id?: string) {
        this.page = page;
        this.utils = new Utilities();
        this.id = id || '';
        // initialize locators...
    }

    async searchPage() {
        await this.page.goto(Utilities.URLS[this.id]);
    }

    async getJobs(): Promise<Job[]> {
        // extract and return normalized jobs
        return this.utils.normalizeJobs(rawJobs);
    }
}
```

2. **Add a test spec** in `tests/`:

```typescript
import { test } from '@playwright/test';
import { NewProvider } from '@pages/newProvider';
import { Utilities } from '@classes/utilities';

test.describe('New Provider', () => {
    const sites = Utilities.getSitesByProvider('newprovider');
    const utils = new Utilities();

    for (const site of sites) {
        test(`New Provider ${site.org}`, async ({ page }) => {
            const provider = new NewProvider(page, site.id);
            await provider.searchPage();
            const jobs = await provider.getJobs();
            if (site.id) await utils.batchAppendJobs(site.id, jobs);
        });
    }
});
```

3. **Add sites** to `test-data/sites.json` with the matching `Provider` value.

---

## Job Results

Results are written to `test-data/jobResults.json` and persist across runs. Each entry is keyed by organization name:

```json
{
  "Example Organization": {
    "Site": "Example Organization",
    "URL": "https://example.com/careers",
    "jobs": [
      {
        "id": "JOB123",
        "title": "QA Automation Engineer",
        "link": "https://example.com/careers/JOB123",
        "status": "0",
        "date": "2026-05-13",
        "notes": ""
      }
    ]
  }
}
```

### Status values

| Value | Meaning |
|---|---|
| `"0"` | New / not yet reviewed |
| `"1"` | Applied |
| `"2"` | Response received |
| `"3"` | Interviewing |
| `"4"` | Declined |

Jobs already present in `jobResults.json` are never overwritten — their `status` and `notes` are preserved across subsequent runs.

---

## How batch writes work

Playwright's parallel execution means multiple tests can finish and attempt file writes simultaneously. Writing directly to `jobResults.json` from parallel workers would cause data races and corruption.

Instead:

1. Each test calls `batchAppendJobs()`, which writes to an isolated file in `test-data/.batch/<org>.json`
2. After all tests complete, `globalTeardown` calls `consolidateBatchWrites()`, which reads all batch files, merges them into `jobResults.json` with deduplication, and cleans up the `.batch` directory

This guarantees no data loss or file collisions regardless of how many workers are running.

---

## CDP Integration

Some sites (BISD) require a session logged in through a real browser, or actively detect and block headless automation. For these, the framework connects to a locally running Chrome instance via the Chrome Debug Protocol (CDP).

`CDPValidator` checks port 9222 for an active CDP session. If unavailable, it attempts to launch Chrome with `--remote-debugging-port=9222`. Tests that depend on CDP skip gracefully if a connection cannot be established.

`SpecialContextPage` provides two modes:
- `noNavigator()` — creates a new browser context and patches `navigator.webdriver` out of the prototype chain at page initialization
- `cdpBrowser()` — connects to the CDP endpoint and creates an isolated context on the live Chrome instance

---

## Roadmap

- [ ] Deploy self-hosted Chrome debug container via GitHub Actions
- [x] Web dashboard for job tracking ([vibe-tracker](https://github.com/keithsecond/vibe-tracker))
- [ ] Additional provider integrations
- [ ] Email or notification alerts for new jobs
- [ ] Job filtering and keyword scoring