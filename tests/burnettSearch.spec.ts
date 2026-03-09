import { test, expect } from '@fixtures/burnett';
import { Utilities } from '@classes/utilities';

test.describe('Burnett Tests', () => {
    const utils = new Utilities();
    const jobQA = 'quality assurance';
    const jobDesktop = 'desktop support';
    const jobSupport = 'technical support';
    const jobSDET = 'SDET';
    const jobTerms: string[] = [jobDesktop, jobSupport, jobSDET, jobQA];

    for (const term of jobTerms) {
        test.use({city: 'Houston, TX', jobType: 'Information Technology', skills: term });
        test (`search ${term}`, async ({ burnettSearch }) => {
            const container = burnettSearch.resultContainer;
            const jobs = burnettSearch.jobs;
            await burnettSearch.search();
            await expect(container, 'search produced results').toBeVisible();
            const allJobs = await jobs.all();
            await utils.newJobsWriteJSON(allJobs, 'Burnett');
        })
    }
});