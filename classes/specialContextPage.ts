import { Page, Browser, BrowserContext } from '@playwright/test';
import { chromium } from "playwright";

export class SpecialContextPage {
    page: Page;
    browser: Browser;
    context: BrowserContext;
 
    constructor(browser: Browser, page: Page) {
        this.browser = browser;
        this.page = page;
        this.context = context;
    }

    async noNavigator() {
        this.context = await this.browser.newContext({
        });
        this.page = await this.context.newPage();
        await this.page.addInitScript("delete Object.getPrototypeOf(navigator).webdriver");
    }
    
    async cdpBrowser() {
        this.browser = await chromium.connectOverCDP('http://localhost:9222');
        this.context = await this.browser.newContext();
        this.page = await this.context.newPage();
        console.log(this.browser.contexts().length);
    }
}
