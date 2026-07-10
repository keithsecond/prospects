import { test } from '@playwright/test';
import { Ashby } from '@pages/ashby';
import { Greenhouse } from '@pages/greenhouse';
import { Lever } from '@pages/lever';
import { SmartRecruiters } from '@pages/smartrecruiters';
import { Recruitee } from '@pages/recruitee';
import { Eightfold } from '@pages/eightfold';
import { Utilities, Job } from '@classes/utilities';
import filters from '../test-data/filters.json';

const SDET = /sdet|software development engineer in test|quality|quality assurance|test/i;
const utils = new Utilities();

function sdetOnly(jobs: Job[]): Job[] {
    return jobs.filter(j => SDET.test(j.title));
}

test.describe('SDET Search — Ashby', () => {
    const sites = Utilities.getSitesByProvider('ashby');
    let accJobs: Job[] = [];
    let seenIds = new Set<string>();

    for (const site of sites) {
        test(site.org, async ({ page }, testInfo) => {
            const ashby = new Ashby(page, site.id);
            await ashby.searchPage();
            testInfo.skip(ashby.noAdmin, 'No jobs available');
            const jobs = sdetOnly(await ashby.getJobs());
            if (!jobs.length) return;
            const newJobs = jobs.filter(j => !seenIds.has(j.id));
            newJobs.forEach(j => seenIds.add(j.id));
            accJobs.push(...newJobs);
            const details = await ashby.jobDetails(accJobs);
            await utils.writeDetails(site.id, details);
            await utils.batchAppendJobs(site.id, jobs);
        });
    }
});

test.describe('SDET Search — Greenhouse', () => {
    const sites = Utilities.getSitesByProvider('greenhouse');
    let accJobs: Job[] = [];
    let seenIds = new Set<string>();

    for (const site of sites) {
        test(site.org, async ({ page }, testInfo) => {
            const greenhouse = new Greenhouse(page, site.id);
            await greenhouse.searchPage();
            testInfo.skip(greenhouse.noAdmin, 'No jobs available');
            const jobs = sdetOnly(await greenhouse.getJobs());
            if (!jobs.length) return;
            const newJobs = jobs.filter(j => !seenIds.has(j.id));
            newJobs.forEach(j => seenIds.add(j.id));
            accJobs.push(...newJobs);
            const details = await greenhouse.jobDetails(accJobs);
            await utils.writeDetails(site.id, details);
            await utils.batchAppendJobs(site.id, jobs);
        });
    }
});

test.describe('SDET Search — Lever', () => {
    const sites = Utilities.getSitesByProvider('lever');
    let accJobs: Job[] = [];
    let seenIds = new Set<string>();

    for (const site of sites) {
        test(site.org, async ({ page }, testInfo) => {
            const lever = new Lever(page, site.id);
            await lever.searchPage();
            testInfo.skip(lever.noAdmin, 'No jobs available');
            const jobs = sdetOnly(await lever.getJobs());
            if (!jobs.length) return;
            const newJobs = jobs.filter(j => !seenIds.has(j.id));
            newJobs.forEach(j => seenIds.add(j.id));
            accJobs.push(...newJobs);
            const details = await lever.jobDetails(accJobs);
            await utils.writeDetails(site.id, details);
            await utils.batchAppendJobs(site.id, jobs);
        });
    }
});

test.describe('SDET Search — SmartRecruiters', () => {
    const sites = Utilities.getSitesByProvider('smartrecruiters');
    let accJobs: Job[] = [];
    let seenIds = new Set<string>();

    for (const site of sites) {
        test(site.org, async ({ page }, testInfo) => {
            const sr = new SmartRecruiters(page, site.id);
            await sr.searchPage();
            testInfo.skip(sr.noAdmin, 'No jobs available');
            const jobs = sdetOnly(await sr.getJobs());
            if (!jobs.length) return;
            const newJobs = jobs.filter(j => !seenIds.has(j.id));
            newJobs.forEach(j => seenIds.add(j.id));
            accJobs.push(...newJobs);
            const details = await sr.jobDetails(accJobs);
            await utils.writeDetails(site.id, details);
            await utils.batchAppendJobs(site.id, jobs);
        });
    }
});

test.describe('SDET Search — Recruitee', () => {
    const sites = Utilities.getSitesByProvider('recruitee');
    let accJobs: Job[] = [];
    let seenIds = new Set<string>();

    for (const site of sites) {
        test(site.org, async ({ page }, testInfo) => {
            const recruitee = new Recruitee(page, site.id);
            await recruitee.searchPage();
            testInfo.skip(recruitee.noAdmin, 'No jobs available');
            const jobs = sdetOnly(await recruitee.getJobs());
            if (!jobs.length) return;
            const newJobs = jobs.filter(j => !seenIds.has(j.id));
            newJobs.forEach(j => seenIds.add(j.id));
            accJobs.push(...newJobs);
            const details = await recruitee.jobDetails(accJobs);
            await utils.writeDetails(site.id, details);
            await utils.batchAppendJobs(site.id, jobs);
        });
    }
});

// Eightfold supports native keyword search via the `query` param — pass 'sdet'
// directly to the API rather than fetching all positions and filtering client-side.
test.describe('SDET Search — Eightfold', () => {
    let accJobs: Job[] = [];
    let seenIds = new Set<string>();

    for (const [siteId, site] of Object.entries(filters)) {
        test.beforeAll(async () => {
            const persistedIds = await Utilities.getSiteJobIds(siteId);
            for (const id of persistedIds) seenIds.add(id);
        });

        test(site.org, async ({ page }) => {
            const ef = new Eightfold(page, site.subdomain, site.domain);
            const jobs = await ef.getJobs({
                ...site.filters as Record<string, string | string[]>,
                query: 'sdet',
            });
            if (!jobs.length) return;
            const newJobs = jobs.filter(j => !seenIds.has(j.id));
            newJobs.forEach(j => seenIds.add(j.id));
            accJobs.push(...newJobs);
            const details = await ef.jobDetails(accJobs);
            await utils.writeDetails(siteId, details);
            await utils.batchAppendJobs(siteId, jobs);
        });
    }
});
