import { test } from '@playwright/test';
import { Utilities } from '@classes/utilities';
import { R001 } from '@pages/localRecruiters/r001/r001Search';


test.describe('r001 Tests', () => {
    const utils = new Utilities();
    if (process.env.SEARCH) {
        const searchQuery = process.env.SEARCH;
        test(`search ${searchQuery}`, async ({ page }) => {
            const r001 = new R001(page);
            await r001.searchPage();
            await r001.search(searchQuery);
            const jobs = await r001.getJobs();
            await utils.batchAppendJobs('r001', jobs);
        });
        return;
    }

    const jobQA = 'quality assurance';
    const jobDesktop = 'desktop support';
    const jobSupport = 'technical support';
    const jobSDET = 'SDET';
    const jobTerms = [jobDesktop, jobSupport, jobSDET, jobQA];

//    for (const term of jobTerms) {
    test.describe('search for IT Jobs', () => {
        test('search IT Jobs', async ({ page }) => {
            const r001 = new R001(page);
            await r001.searchPage();
            await r001.search();
            const jobs = await r001.getJobs();
            await utils.batchAppendJobs('r001', jobs);
        });
    });
//    }
});
