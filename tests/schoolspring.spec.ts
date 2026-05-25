import { test } from '@playwright/test';
import { SchoolSpring } from '@pages/schoolspring';
import { Utilities, Job } from '@classes/utilities';


test.describe('SchoolSpring', () => {
    const schoolspringSites = Utilities.getSitesByProvider('schoolspring');
    const utils = new Utilities();
    let ssJobs: Job[] = [];
    let existingJobIds = new Set<string>();

    for (const site of schoolspringSites) {
        test(`${site.org} Jobs`, async ({ page }, testInfo) => {
            const schoolSpring = new SchoolSpring(page, site.id);
            await schoolSpring.searchPage();
            testInfo.skip(schoolSpring.noAdmin, 'No tech jobs');
            const jobs = await schoolSpring.getJobs();
            const newJobs: Job[] = [];
            for (const job of jobs) {
                if (!existingJobIds.has(job.id)) {
                    existingJobIds.add(job.id);
                    newJobs.push(job);
                }
            }
            ssJobs.push(...newJobs);

            const details = await schoolSpring.jobDetails(ssJobs);
            await utils.writeDetails(site.id as string, details);
            if (site.id !== undefined) {
                await utils.batchAppendJobs(site.id, jobs);
            }
        });
    }
});