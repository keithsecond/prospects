import { test } from '@playwright/test';
import { Ashby } from '@pages/ashby';
import { Utilities, Job } from '@classes/utilities';

test.describe('Ashby', () => {
    const ashbySites = Utilities.getSitesByProvider('ashby');
    const utils = new Utilities();
    let ashbyJobs: Job[] = [];
    let existingJobIds = new Set<string>();

    for (const site of ashbySites) {
        test(`${site.org} Jobs`, async ({ page }, testInfo) => {
            const ashby = new Ashby(page, site.id);
            await ashby.searchPage();
            testInfo.skip(ashby.noAdmin, 'No jobs available');
            const jobs = await ashby.getJobs();
            const newJobs: Job[] = [];
            for (const job of jobs) {
                if (!existingJobIds.has(job.id)) {
                    existingJobIds.add(job.id);
                    newJobs.push(job);
                }
            }
            ashbyJobs.push(...newJobs);

            const details = await ashby.jobDetails(ashbyJobs);
            await utils.writeDetails(site.id as string, details);
            if (site.id !== undefined) {
                await utils.batchAppendJobs(site.id, jobs);
            }
        });
    }
});
