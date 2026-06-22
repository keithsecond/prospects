import { test } from '@playwright/test';
import { Eightfold } from '@pages/eightfold';
import { Utilities, Job } from '@classes/utilities';
import filters from '../test-data/filters.json';

const utils = new Utilities();
let efJobs: Job[] = [];
let existingJobIds = new Set<string>();

test.describe(() => {
    if (process.env.JOBID) {
        const [subdomain, domain, jobId] = process.env.JOBID.split(',');
        test(`search ${jobId}`, async ({ page }) => {
            const ef = new Eightfold(page, subdomain, domain);
            const url = ef.buildDetailsUrl(jobId, domain);
            const details = await ef.singleJobDetails(jobId, domain);
            await utils.writeDetails(subdomain, details);
        });
    return;
    }

    for (const [siteId, site] of Object.entries(filters)) {
        test.beforeAll( async ({}) => {
            const persistedIds = await Utilities.getSiteJobIds(siteId);
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
            const details = await ef.jobDetails(efJobs);
            await utils.writeDetails(siteId, details);
            await utils.batchAppendJobs(siteId, jobs);
        });
    }
})