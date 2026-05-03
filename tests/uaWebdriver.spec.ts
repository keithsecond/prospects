import { test } from '@playwright/test';
import { SpecialContextPage } from '@classes/specialContextPage';

test.describe('UA Webdriver Tests', () => {
    let specialContextPage: SpecialContextPage;

    test('test goto', async ({ browser, page }) => {
        specialContextPage = new SpecialContextPage(browser, page);
        await specialContextPage.noNavigator();
        await specialContextPage.page.goto('https://bot.sannysoft.com/');
        await page.screenshot({ path: 'test-data/screenshotNoNav.png' });
    });

    test('test goto1', async ({ browser, page }, testInfo) => {
        specialContextPage = new SpecialContextPage(browser, page);
        await specialContextPage.cdpBrowser();
        testInfo.skip(specialContextPage.noCdp, 'No CDP connection available');
        await specialContextPage.page.goto('https://bot.sannysoft.com/');
        await page.screenshot({ path: 'test-data/screenshotCDP.png' });
    });
});
