import { test } from '@fixtures/burnett';

test.describe('Burnett Tests', () => {

    if (process.env.SEARCH) { const searchQuery = process.env.SEARCH; 
        test.use({city: "Houston, TX", jobType: 'Information Technology', skills: searchQuery });
        test (`search ${searchQuery}`, async ({ search, utils }) => {
            await search.search();
            const jobs = await search.getJobs();
            await utils.writeJobs('Burnett', jobs);
        })
        return;
    };
    
    const jobQA = 'quality assurance';
    const jobDesktop = 'desktop support';
    const jobSupport = 'technical support';
    const jobSDET = 'SDET';
    const jobTerms = [jobDesktop, jobSupport, jobSDET, jobQA];

    for (const term of jobTerms) {
        test.use({city: "Houston, TX", jobType: 'Information Technology', skills: term });
        test (`search ${term}`, async ({ search, utils }) => {
            await search.search();
            const jobs = await search.getJobs();
            await utils.writeJobs('Burnett', jobs);
        })
    }
});