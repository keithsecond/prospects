# PROSPECTS

A Playwright tool to assist in employment search

## Features

- Contains a class for a easy CDP browser instantiation
- Stateful status of job postings

```sh
prospects/
│
├── auth/                   # Authentication storage
├── tests/                  # Test specifications
    └── jobResults.json     # Search results JSON data store
├── pages/                  # Page Object Model classes
├── fixtures/               # Shared test fixtures (if used)
├── classes/                # Browser helper classes
├── utils/                  # Helper utilities
├── playwright.config.ts
├── package.json
├── README.md
└── tsconfig.json
```
<img src="./Playwright Test Report Summary.png" alt="report detail" />

---

## Installation

[Playwright](https://playwright.dev/docs/intro) chromium installation
```sh
npx playwright install chromium
```

A running chrome browser with debugging port

## Usage

### Check CDP browser

```sh
npx playwright test -ui tests/uaWebdriver.spec.ts
```

### Check a website

```sh
npx playwright test tests/burnettSearch.spec.ts
```

### CLI job search

```sh
export SEARCH="search term"; \ 
npx playwright test tests/burnettSearch.spec.ts && unset SEARCH
```

### Check all websites - not recommended until CDP is confirmed

```sh
npx playwright test
```

<img src="./Playwright Test Report.png" alt="report detail" />

## Disclaimer

This tool is a proof of concept and should not be used in a production environment. It is designed for educational purposes only. According to many, if not all, of the website's terms of service, the use of robots, spiders, manual, and/or automatic processes, or devices to data-mine, data-crawl, scrape, or index the Website in any manner is prohibited. Use this tool responsibly and at your own risk.
