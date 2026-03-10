import { Locator } from '@playwright/test';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

export class Utilities {

    async newJobsWriteJSON(allJobs: Locator[], key: string) {
        const filePath = path.join(__dirname, '../tests/jobResults.json');
        const fileData = await readFile(filePath, 'utf-8');
        const data = JSON.parse(fileData);
        if (!data[key]) {
           data[key] = { jobs: [] };
        }
        const existingJobIds = new Set(data[key].jobs.map((job: { id: string; }) => job.id));

        for (const jobWeb of allJobs) {
            const jobTitle = await jobWeb.textContent();
            const link = await jobWeb.getAttribute('href');
            if (!link || link == '#') {
                continue;
            }
            const jobID = link.split('/').pop();
            const scrapedJobs = {
                id: jobID,
                title: jobTitle,
                status: '0',
                date: new Date().toISOString().split('T')[0],
                notes: ''
            };
            if (!existingJobIds.has(scrapedJobs.id)) {
                data[key].jobs.push(scrapedJobs);
                existingJobIds.add(scrapedJobs.id);
            }        
        }
        await writeFile(filePath, JSON.stringify(data, null, 2));
    }
}