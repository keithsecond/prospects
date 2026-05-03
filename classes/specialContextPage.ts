import { Page, Browser, BrowserContext } from '@playwright/test';
import { chromium } from 'playwright';

export class SpecialContextPage {
    page: Page;
    browser: Browser;
    context?: BrowserContext;

    constructor(
        browser: Browser,
        page: Page | null
    ) {
        this.browser = browser;
        this.page = page as Page;
    }

    async noNavigator() {
        const context = await this.browser.newContext({});
        this.page = await context.newPage();
        await this.page.addInitScript(
            'delete Object.getPrototypeOf(navigator).webdriver'
        );
        this.context = context;
    }

    async cdpBrowser() {
        if (this.context) {
            await this.context.close();
        }
        this.browser = await chromium.connectOverCDP('http://localhost:9222');

        // Create a fresh context for this test
        // Other parallel tests will have their own contexts - they're isolated
        const context = await this.browser.newContext();
        this.page = await context.newPage();
        this.context = context;
    }
}