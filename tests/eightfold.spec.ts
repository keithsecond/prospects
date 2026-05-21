import { test } from '@playwright/test';
import { Eightfold } from '@pages/eightfold';
import { Utilities, Job } from '@classes/utilities';
import filters from '../test-data/filters.json';

const utils = new Utilities();
let efJobs: Job[] = [];
let existingJobIds = new Set<string>();
test.describe.configure({ mode: 'serial' });

for (const [siteId, site] of Object.entries(filters)) {
    test.beforeAll( async ({}) => {
        const persistedIds = await Utilities.getSiteJobIds(siteId) as string[];
        for (const id of persistedIds) {
            existingJobIds.add(id);
        }
    });
    test(`${site.org} Jobs`, async ({ page }) => {
        const ef = new Eightfold(page, site.subdomain, site.domain);
        const jobs = await ef.getJobs(
            site.filters as Record<string, string | string[]>
        );
        const newJobs: Job[] = [];
        for (const job of jobs) {
            if (!existingJobIds.has(job.id)) {
                existingJobIds.add(job.id);
                newJobs.push(job);
            }
        }
        efJobs.push(...newJobs);
        await utils.batchAppendJobs(siteId, jobs);
    });

    test(`${site.org} Job Details`, async ({ page }) => {
        const ef = new Eightfold(page, site.subdomain, site.domain);
        const details = await ef.jobDetails(efJobs);
        await utils.writeDetails(siteId, details);
    });
}