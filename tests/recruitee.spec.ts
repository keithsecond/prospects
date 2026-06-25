import { test } from '@playwright/test';
import { Recruitee } from '@pages/recruitee';
import { Utilities, Job } from '@classes/utilities';

test.describe('Recruitee', () => {
    const recruiteeSites = Utilities.getSitesByProvider('recruitee');
    const utils = new Utilities();
    let recruiteeJobs: Job[] = [];
    let existingJobIds = new Set<string>();

    for (const site of recruiteeSites) {
        test(`${site.org} Jobs`, async ({ page }, testInfo) => {
            const recruitee = new Recruitee(page, site.id);
            await recruitee.searchPage();
            testInfo.skip(recruitee.noAdmin, 'No jobs available');
            const jobs = await recruitee.getJobs();
            const newJobs: Job[] = [];
            for (const job of jobs) {
                if (!existingJobIds.has(job.id)) {
                    existingJobIds.add(job.id);
                    newJobs.push(job);
                }
            }
            recruiteeJobs.push(...newJobs);

            const details = await recruitee.jobDetails(recruiteeJobs);
            await utils.writeDetails(site.id as string, details);
            if (site.id !== undefined) {
                await utils.batchAppendJobs(site.id, jobs);
            }
        });
    }
});
