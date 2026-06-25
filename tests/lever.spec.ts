import { test } from '@playwright/test';
import { Lever } from '@pages/lever';
import { Utilities, Job } from '@classes/utilities';

test.describe('Lever', () => {
    const leverSites = Utilities.getSitesByProvider('lever');
    const utils = new Utilities();
    let leverJobs: Job[] = [];
    let existingJobIds = new Set<string>();

    for (const site of leverSites) {
        test(`${site.org} Jobs`, async ({ page }, testInfo) => {
            const lever = new Lever(page, site.id);
            await lever.searchPage();
            testInfo.skip(lever.noAdmin, 'No jobs available');
            const jobs = await lever.getJobs();
            const newJobs: Job[] = [];
            for (const job of jobs) {
                if (!existingJobIds.has(job.id)) {
                    existingJobIds.add(job.id);
                    newJobs.push(job);
                }
            }
            leverJobs.push(...newJobs);

            const details = await lever.jobDetails(leverJobs);
            await utils.writeDetails(site.id as string, details);
            if (site.id !== undefined) {
                await utils.batchAppendJobs(site.id, jobs);
            }
        });
    }
});
