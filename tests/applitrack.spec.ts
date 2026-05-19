import { test } from '@playwright/test';
import { Applitrack } from '@pages/applitrack';
import { Utilities } from '@classes/utilities';

test.describe('Applitrack Workboards', () => {
    const applitrackSites = Utilities.getSitesByProvider('applitrack');
    const utils = new Utilities();

    for (const site of applitrackSites) {
        test(`Applitrack ${site.org}`, async ({ page }, testInfo) => {
            const applitrack = new Applitrack(page, site.id);
            await applitrack.searchPage();
            testInfo.skip(applitrack.noAdmin, 'No tech jobs');
            const jobs = await applitrack.getJobs();
            if (site.id !== undefined) {
                await utils.batchAppendJobs(site.id, jobs);
            }
        });
    }
});