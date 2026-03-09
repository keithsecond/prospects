import { test, expect, Locator } from '@fixtures/burnett';
import fs from 'fs';
import path from 'path';

test.describe('Burnett Tests', () => {
    const jobQA = 'quality assurance';
    const jobDesktop = 'desktop support';
    const jobSupport = 'technical support';
    const jobSDET = 'SDET';
    const jobAll = '';
    const jobTerms: string[] = [jobDesktop, jobSupport, jobSDET, jobQA];

    for (const term of jobTerms) {
        test.use({ skills: term });
        test (`search ${term}`, async ({ burnettSearch }) => {
            const container = burnettSearch.resultContainer;
            const jobs = burnettSearch.jobs;

            await burnettSearch.search();
            await expect(container, 'search produced results').toBeVisible();
            const allJobs: Locator[] = await jobs.all();
            await jobLoop(allJobs);
        })
    }
});

async function jobLoop(allJobs: Locator[]) {
    const filePath = path.join(__dirname, 'jobResults.json');
    const fileData = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileData);
    const existingJobIds = new Set(data.Burnett.jobs.map((job: { id: string; }) => job.id));

    for (const jobWeb of allJobs) {
        const jobTitle = await jobWeb.innerText();
        const link = await jobWeb.getAttribute('href');
        if (link == '#') {
            return;
        }
        if (link !== null) {
            const jobID = link.split('/').slice(-1)[0];
            const scrapedJobs = {
                id: jobID,
                title: jobTitle,
                status: '0',
                date: new Date().toISOString()
            };
            if (!existingJobIds.has(scrapedJobs.id)) {
                data.Burnett.jobs.push(scrapedJobs);
                existingJobIds.add(scrapedJobs.id);
            }
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        }
}