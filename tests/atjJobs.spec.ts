import { test } from '@playwright/test';
import { ATJ } from '@pages/atjSearch';
import { Utilities } from '@classes/utilities';

test.describe('ApplyToJobs Workboards', () => {
    const atjSites = Utilities.getSitesByProvider('ATJ');
    const utils = new Utilities();

    for (const site of atjSites) {
        test(`ATJ ${site.org}`, async ({ page }) => {
            const atj = new ATJ(page, site.id);
            await atj.searchPage();
            const jobs = await atj.getJobs();
            if (site.id !== undefined) {
                await utils.batchAppendJobs(site.id, jobs);
            }
        });
    }
});
