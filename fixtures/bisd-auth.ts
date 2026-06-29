import { test as base } from '@playwright/test';
import { BISD } from '@pages/bisd';
import { SpecialContextPage } from '@classes/specialContextPage';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.auth/.env') });

type BISDFixtures = {
    bisd: BISD;
};

export const test = base.extend<{}, BISDFixtures>({
    bisd: [async ({ browser }, use) => {
        const specialContext = new SpecialContextPage(browser, null as any);
        await specialContext.cdpBrowser();
        const bisd = new BISD(specialContext.page);
        await bisd.searchPage();

        const email = process.env.BISD_EMAIL;
        const password = process.env.BISD_PASSWORD;
        if (email && password) {
            await bisd.login(email, password);
        } else {
            console.warn('BISD_EMAIL or BISD_PASSWORD not set in .auth/.env - skipping login');
        }

        await use(bisd);

        await specialContext.page.close();
    }, { scope: 'worker' }],
});