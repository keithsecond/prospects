import { Page, Browser, BrowserContext } from '@playwright/test';
import { chromium } from 'playwright';
import { CDPValidator } from './cdpValidator';


export class SpecialContextPage {
    page: Page;
    browser: Browser;
    context?: BrowserContext;
    noCdp: boolean;

    constructor(
        browser: Browser,
        page: Page | null
    ) {
        this.browser = browser;
        this.page = page as Page;
        this.noCdp = false;
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
        // Check if CDP is available
        this.noCdp = await CDPValidator.isUnavailable();
        if (this.noCdp) {
            return;
        }
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