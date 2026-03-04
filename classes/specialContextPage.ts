import { expect, type Locator, type Page, type Browser } from '@playwright/test';

export class SpecialContextPage {
    page: Page;
    browser: Browser;
    context: any;
 
    constructor(browser: Browser, page: Page) {
        this.browser = browser;
        this.page = page;
    }

    async noNavigator() {
        this.context = await this.browser.newContext({
            storageState: './auth.json',
        });
        this.page = await this.context.newPage();
        await this.page.addInitScript("delete Object.getPrototypeOf(navigator).webdriver");
//        await this.page.goto('https://playwright.dev');

/*     await this.page.addInitScript(() => {
        // TypeScript code within the evaluate function runs in the browser context
        delete Object.getPrototypeOf(navigator).webdriver;
    }); */
  }
}
