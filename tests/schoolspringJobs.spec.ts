import { test, expect } from '@playwright/test';
import { SchoolSpring } from '@pages/schoolspring';
import { Utilities } from '@classes/utilities';



test.describe('SchoolSpring Workboards', () => {
    const schoolspringSites = Utilities.getSitesByProvider("schoolspring");
    const utils = new Utilities();

    schoolspringSites.forEach(site => {
        test(`SchoolSpring ${site.org}`, async ({ page }) => {
            const schoolspring = new SchoolSpring(page, site.id);
            await schoolspring.searchPage();
            const jobs = await schoolspring.getJobs();
            if (site.id !== undefined)
                await utils.writeJobs(site.id, jobs);
        });
    });
});
