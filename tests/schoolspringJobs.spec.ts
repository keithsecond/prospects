import { test } from '@playwright/test';
import { SchoolSpring } from '@pages/schoolspring';
import { Utilities } from '@classes/utilities';

test.describe('SchoolSpring Workboards', () => {
    const schoolspringSites = Utilities.getSitesByProvider('schoolspring');
    const utils = new Utilities();

    schoolspringSites.forEach(site => {
        test(`SchoolSpring ${site.org}`, async ({ page }, testInfo) => {
            const schoolspring = new SchoolSpring(page, site.id);
            await schoolspring.searchPage();
            testInfo.skip(schoolspring.noAdmin, 'No tech jobs');
            const jobs = await schoolspring.getJobs();
            if (site.id !== undefined) await utils.batchAppendJobs(site.id, jobs);
        });
    });
});
