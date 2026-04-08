# PROSPECTS

[![Playwright](https://img.shields.io/badge/Playwright-45ba4b?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)

A comprehensive Playwright-based tool for automated job search across multiple employment platforms. Features parallel test execution, batch job consolidation, and stateful job tracking.

## ✨ Features

- **Parallel Test Execution**: Run job searches across multiple sites simultaneously using all CPU cores
- **Batch Job Consolidation**: Safe file writing prevents data collisions during parallel execution
- **Stateful Job Tracking**: Maintains job application status and notes
- **Multiple Job Boards**: Supports ADP, ApplyToJob, SchoolSpring, Applitrack, and recruiter platforms
- **Custom Browser Automation**: Includes CDP browser integration for enhanced scraping capabilities
- **Comprehensive Reporting**: HTML test reports with screenshots and traces

## 📁 Project Structure

```
prospects/
│
├── auth/                   # Authentication storage (.gitignore)
├── tests/                  # Test specifications for each job board
├── pages/                  # Page Object Model classes
├── fixtures/               # Shared test fixtures and configurations
├── classes/                # Helper utilities for JSON data mapping
├── test-data/              # JSON datastores (.gitignore)
│   ├── jobResults.json     # Consolidated job search results
│   ├── sites.json          # Configured job search sites
│   └── .batch/             # Temporary batch files (auto-cleaned)
├── playwright.config.ts    # Playwright configuration
├── globalTeardown.ts       # Post-test cleanup handler
├── package.json
├── README.md
└── tsconfig.json
```

## 🚀 Installation

### Prerequisites

- Node.js 16+
- npm or yarn

### Setup

**Install Dependencies Playwright browsers**
   ```bash
   npm install
   npx playwright install chromium
   ```

## 📖 Usage

### Basic Job Search

Run all configured job searches in parallel:
```bash
npm test
```

### Single Site Testing

Test a specific job board:
```bash
# ADP Workboards
npx playwright test tests/adpJobs.spec.ts

# ApplyToJob sites
npx playwright test tests/atjJobs.spec.ts

# School districts
npx playwright test tests/schoolspringJobs.spec.ts
```

### Custom Search Queries

Search for specific job terms:
```bash
# Set search term and run recruiter search
export SEARCH="software engineer"
npx playwright test tests/R001Search.spec.ts
unset SEARCH
```

### Browser Compatibility Testing

Test CDP browser integration:
```bash
npx playwright test tests/uaWebdriver.spec.ts --ui
```

### CI/CD Execution

For continuous integration (runs serially):
```bash
CI=true npm test
```

## 🔧 Configuration

### Job Sites Configuration

Edit `test-data/sites.json` to add or modify job search sites:

```json
{
  "Private": [
    {
      "id": "P001",
      "org": "Example School",
      "URL": "https://example.com/jobs",
      "Provider": "ADP"
    }
  ]
}
```

### Playwright Configuration

Modify `playwright.config.ts` for custom settings:

- **Parallel execution**: `fullyParallel: true`
- **Worker count**: `workers: undefined` (auto-detect CPU cores)
- **Timeouts**: Adjust timeouts for slower sites
- **Browser options**: Configure browser launch parameters

## 📊 Results & Data Management

### Job Results Structure

Jobs are stored in `test-data/jobResults.json` with the following structure:

```json
{
  "Organization Name": {
    "Site": "Organization Name",
    "URL": "https://example.com/jobs",
    "jobs": [
      {
        "id": "JOB123",
        "title": "Software Engineer",
        "link": "https://example.com/job/JOB123",
        "status": "0",
        "date": "2024-01-15",
        "notes": ""
      }
    ]
  }
}
```

### Status Definitions

- `"0"`: New job
- `"1"`: Applied
- `"2"`: Received reply
- `"3"`: Interviewing
- `"4"`: Declined

## 🛠️ Development

### Adding New Job Boards

1. **Create Page Object Model** in `pages/`
   ```typescript
   export class NewJobBoard {
     constructor(page: Page, siteId?: string) {}
     async searchPage() { /* Navigate to search page */ }
     async getJobs(): Promise<Job[]> { /* Extract jobs */ }
   }
   ```

2. **Add test specification** in `tests/`
   ```typescript
   test.describe('New Job Board', () => {
     const sites = Utilities.getSitesByProvider('newboard');
     sites.forEach(site => {
       test(`Search ${site.org}`, async ({ page }) => {
         const board = new NewJobBoard(page, site.id);
         await board.searchPage();
         const jobs = await board.getJobs();
         await utils.batchAppendJobs(site.id, jobs);
       });
     });
   });
   ```

3. **Update site configuration** in `test-data/sites.json`

### Running Tests in Development

```bash
# Run with UI mode for debugging
npx playwright test --ui

# Run specific test with debugging
npx playwright test tests/example.spec.ts --debug

# Generate and view HTML report
npx playwright show-report
```

## 📋 TODO

- [ ] Deploy self-hosted chrome-debug docker container via Github actions
- [ ] Add more job board integrations
- [ ] Implement job application automation
- [ ] Add email notifications for new jobs
- [ ] Create web dashboard for job tracking [vibe-tracker](https://github.com/keithsecond/vibe-tracker)
- [ ] Add job filtering and search capabilities
- [ ] Document API for external integrations

## ⚠️ Disclaimer

This tool is a proof of concept and should not be used in a production environment. It is designed for educational purposes only.

**Important**: According to the terms of service of most job search websites, the use of robots, spiders, manual, and/or automatic processes, or devices to data-mine, data-crawl, scrape, or index websites is prohibited. Use this tool responsibly and at your own risk.
