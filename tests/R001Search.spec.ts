import { test } from '@fixtures/recruiter001';

test.describe('r001 Tests', () => {

    if (process.env.SEARCH) { const searchQuery = process.env.SEARCH; 
        test.use({city: "Houston, TX", jobType: 'Information Technology', skills: searchQuery });
        test (`search ${searchQuery}`, async ({ search, utils }) => {
            await search.search();
            const jobs = await search.getJobs();
            await utils.writeJobs('r001', jobs);
        });
        return;
    };
    
    const jobQA = 'quality assurance';
    const jobDesktop = 'desktop support';
    const jobSupport = 'technical support';
    const jobSDET = 'SDET';
    const jobTerms = [jobDesktop, jobSupport, jobSDET, jobQA];

    jobTerms.forEach(term => {
        test.use({city: "Houston, TX", jobType: 'Information Technology', skills: term });
        test (`search ${term}`, async ({ search, utils }) => {
            await search.search();
            const jobs = await search.getJobs();
            await utils.writeJobs('r001', jobs);
        });
    });
});