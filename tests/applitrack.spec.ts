import { test } from '@playwright/test';
import { Applitrack } from '@pages/applitrack';
import { Utilities, Job } from '@classes/utilities';

test.describe('Applitrack Workboards', () => {
    const applitrackSites = Utilities.getSitesByProvider('applitrack');
    const utils = new Utilities();
    let applitrackJobs: Job[] = [];
    let existingJobIds = new Set<string>();

    for (const site of applitrackSites) {
        test(`Applitrack ${site.org}`, async ({ page }, testInfo) => {
            const applitrack = new Applitrack(page, site.id);
            await applitrack.searchPage();
            testInfo.skip(applitrack.noAdmin, 'No tech jobs');
            const jobs = await applitrack.getJobs();
            const newJobs: Job[] = [];
            for (const job of jobs) {
                if (!existingJobIds.has(job.id)) {
                    existingJobIds.add(job.id);
                    newJobs.push(job);
                }
            }
            applitrackJobs.push(...newJobs);

            const details = await applitrack.jobDetails(applitrackJobs);
            await utils.writeDetails(site.id as string, details);
            if (site.id !== undefined) {
                await utils.batchAppendJobs(site.id, jobs);
            }
        });
    }
});