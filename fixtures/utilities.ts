import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import sites from '../utilities/sites.json';

export type Job = {
    id: string;
    title: string | null;
    link: string;
    status: string;
    date: string;
    notes: string;
};

export class Utilities {

    static URLS = Object.fromEntries(
        [
            ...sites.Private,
            ...sites.Public,
            ...sites.Universities,
            ...sites.Sites,
            ...sites.Recruiters
        ].map(x => [x.id, x.URL])
    );
    
    static ORGS: Record<string, string> = Object.fromEntries(
        [
            ...sites.Private,
            ...sites.Public,
            ...sites.Universities,
            ...sites.Sites,
            ...sites.Recruiters
        ].map(x => [x.id, x.org])
    )

    static getSitesByProvider(provider: string) {
        return [
            ...sites.Private,
            ...sites.Public,
            ...sites.Universities,
            ...sites.Sites,
            ...sites.Recruiters
        ].filter(site => site.Provider === provider);
    }

    filePath = path.join(__dirname, '../tests/jobResults.json');

    async writeJobs(key: string, jobs: Job[]) {
        const fileData = await readFile(this.filePath, 'utf-8');
        const data = JSON.parse(fileData);
/*         if (!data[key]) {
            data[key] = { jobs: [] };
        } */
        const org = Utilities.ORGS[key] || key;
        const url = Utilities.URLS[key] || "";
        if (!data[org]) {
            data[org] = {
                Site: "",
                URL: url,
                jobs: []
            };
        }
        const existingJobIds = new Set(
            data[org].jobs.map((job: Job) => job.id)
        );
        for (const job of jobs) {
            if (!existingJobIds.has(job.id)) {
                data[org].jobs.push(job);
            }
        }
        await writeFile(this.filePath, JSON.stringify(data, null, 2));
    }
}