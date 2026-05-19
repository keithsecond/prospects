import { test } from '@playwright/test';
import { ADP } from '@pages/adpSearch';
import { Utilities } from '@classes/utilities';

test.describe('ADP Workboards', () => {
    const adpSites = Utilities.getSitesByProvider('ADP');
    const utils = new Utilities();

    for (const site of adpSites) {
        test(`adp search ${site.org}`, async ({ page }) => {
            const adp = new ADP(page, site.id);
            await adp.searchPage();
            await adp.search();
            const jobs = await adp.getJobs();
            if (site.id !== undefined) {
                await utils.batchAppendJobs(site.id, jobs);
            }
        });
    }
});
