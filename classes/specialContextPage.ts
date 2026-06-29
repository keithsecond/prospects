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

        // Reuse the browser's default context - it's the one backed by the
        // persistent profile mounted at /data, which is where Google SSO
        // session cookies actually get saved across container restarts.
        // A fresh newContext() would be an isolated, non-persistent context
        // unrelated to that on-disk profile.
        const context = this.browser.contexts()[0] ?? await this.browser.newContext();
        this.page = await context.newPage();
        this.context = context;
    }
}