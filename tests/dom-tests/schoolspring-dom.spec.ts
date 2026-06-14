import { test } from '@playwright/test';
import { SchoolSpring } from '../../pages/dom-pages/schoolspring-dom';
import { Utilities, Job } from '../../classes/utilities';


test.describe('SchoolSpring', () => {
    const schoolspringSites = Utilities.getSitesByProvider('schoolspring');
    const utils = new Utilities();
    let schoolSpringJobs: Job[] = [];
    test.describe.configure({ mode: 'serial' });

    for (const site of schoolspringSites) {
        test(`${site.org} Jobs`, async ({ page }, testInfo) => {
            const schoolSpring = new SchoolSpring(page, site.id);
            await schoolSpring.searchPage();
            testInfo.skip(schoolSpring.noAdmin, 'No tech jobs');
            const jobs = await schoolSpring.getJobs();
            schoolSpringJobs.push(...jobs);
            if (site.id !== undefined) {
                await utils.batchAppendJobs(site.id, jobs);
            }
        });
    }
});