import { test } from '@playwright/test';
import { ADP } from '@pages/adpSearch';
import { Utilities } from '@fixtures/utilities';

test.describe('ADP Workboards', () => {
    const adpSites = Utilities.getSitesByProvider("ADP");

    adpSites.forEach(site => {
        test(`adp search ${site.org}`, async ({ page }) => {
            const adp = new ADP(page, site.id); 
            await adp.searchPage(); 
            await adp.search();
            const jobs = await adp.getJobs();
            const utils = new Utilities();
            if (site.id !== undefined)
            await utils.writeJobs(site.id, jobs);
        });
    });
});