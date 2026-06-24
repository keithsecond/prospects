import { test } from '@playwright/test';
import { SmartRecruiters } from '@pages/smartrecruiters';
import { Utilities, Job } from '@classes/utilities';

test.describe('SmartRecruiters', () => {
    const smartrecruitersSites = Utilities.getSitesByProvider('smartrecruiters');
    const utils = new Utilities();
    let smartrecruitersJobs: Job[] = [];
    let existingJobIds = new Set<string>();

    for (const site of smartrecruitersSites) {
        test(`${site.org} Jobs`, async ({ page }, testInfo) => {
            const smartrecruiters = new SmartRecruiters(page, site.id);
            await smartrecruiters.searchPage();
            testInfo.skip(smartrecruiters.noAdmin, 'No jobs available');
            const jobs = await smartrecruiters.getJobs();
            const newJobs: Job[] = [];
            for (const job of jobs) {
                if (!existingJobIds.has(job.id)) {
                    existingJobIds.add(job.id);
                    newJobs.push(job);
                }
            }
            smartrecruitersJobs.push(...newJobs);

            const details = await smartrecruiters.jobDetails(smartrecruitersJobs);
            await utils.writeDetails(site.id as string, details);
            if (site.id !== undefined) {
                await utils.batchAppendJobs(site.id, jobs);
            }
        });
    }
});
