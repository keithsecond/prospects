import { test } from '@playwright/test';
import { ADP } from '@pages/adp';
import { Utilities, Job } from '@classes/utilities';

test.describe('ADP', () => {
    const adpSites = Utilities.getSitesByProvider('ADP');
    const utils = new Utilities();
    let adpJobs: Job[] = [];
    let existingJobIds = new Set<string>();

    for (const site of adpSites) {
        test(`${site.org} Jobs`, async ({ page }, testInfo) => {
            const adp = new ADP(page, site.id);
            await adp.searchPage();
            testInfo.skip(adp.noAdmin, 'No jobs available');
            const jobs = await adp.getJobs();
            const newJobs: Job[] = [];
            for (const job of jobs) {
                if (!existingJobIds.has(job.id)) {
                    existingJobIds.add(job.id);
                    newJobs.push(job);
                }
            }
            adpJobs.push(...newJobs);

            const details = await adp.jobDetails(adpJobs);
            await utils.writeDetails(site.id as string, details);
            if (site.id !== undefined) {
                await utils.batchAppendJobs(site.id, jobs);
            }
        });
    }
});