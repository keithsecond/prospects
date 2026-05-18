import { test } from '@playwright/test';
import { Eightfold } from '@pages/eightfold';
import { Utilities } from '@classes/utilities';
import filters from '../test-data/filters.json';

const utils = new Utilities();

for (const [siteId, site] of Object.entries(filters)) {

    test(`${site.org} Jobs`, async ({ page }) => {
        test.slow();
        const ef = new Eightfold(page, site.subdomain, site.domain);
        const jobs = await ef.getJobs(site.filters as Record<string, string | string[]>);
        await utils.batchAppendJobs(siteId, jobs);
    });

    test(`${site.org} Job Details`, async ({ page }) => {
        test.slow();
        const ef = new Eightfold(page, site.subdomain, site.domain);
        const persistedIds = await Utilities.getSiteJobIds(siteId) as string[];
        const details = await ef.jobDetails(persistedIds);
        await utils.writeDetails(siteId, details);
    });
}
