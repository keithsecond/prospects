import { test } from '@playwright/test';
import { Greenhouse } from '@pages/greenhouse';
import { Utilities, Job } from '@classes/utilities';

test.describe('Greenhouse', () => {
    const greenhouseSites = Utilities.getSitesByProvider('greenhouse');
    const utils = new Utilities();
    let greenhouseJobs: Job[] = [];
    let existingJobIds = new Set<string>();

    for (const site of greenhouseSites) {
        test(`${site.org} Jobs`, async ({ page }, testInfo) => {
            const greenhouse = new Greenhouse(page, site.id);
            await greenhouse.searchPage();
            testInfo.skip(greenhouse.noAdmin, 'No jobs available');
            const jobs = await greenhouse.getJobs();
            const newJobs: Job[] = [];
            for (const job of jobs) {
                if (!existingJobIds.has(job.id)) {
                    existingJobIds.add(job.id);
                    newJobs.push(job);
                }
            }
            greenhouseJobs.push(...newJobs);

            const details = await greenhouse.jobDetails(greenhouseJobs);
            await utils.writeDetails(site.id as string, details);
            if (site.id !== undefined) {
                await utils.batchAppendJobs(site.id, jobs);
            }
        });
    }
});
