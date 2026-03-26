import { test } from '@playwright/test';
import { ATJ } from '@pages/atjSearch';
import { Utilities } from '@classes/utilities';

test.describe('ApplyToJobs Workboards', () => {
    const atjSites = Utilities.getSitesByProvider("ATJ");
    const utils = new Utilities();

    atjSites.forEach(site => {
        test(`ATJ ${site.org}`, async ({ page }) => {
            const atj = new ATJ(page, site.id);
            await atj.searchPage();
            const jobs = await atj.getJobs();
            if (site.id !== undefined)
            await utils.writeJobs(site.id, jobs);

        })


    })





});