import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import sites from '../test-data/sites.json';

export type Job = {
    id: string;
    title: string | null;
    link: string;
    status: string;
    date: string;
    notes: string;
};

export type JobInput = {
    id: string;
    title: string;
    link: string;
};

export class Utilities {
    filePath = path.join(__dirname, '../test-data/jobResults.json');
    batchDir = path.join(__dirname, '../test-data/.batch');

    /**
     * Queues jobs to be written in batch at the end of test run.
     * Prevents file collision and race conditions during parallel execution.
     *
     * @param key provider site key used to map org and URL fields.
     * @param jobs normalized job list to queue for batch writing.
     */
    async batchAppendJobs(key: string, jobs: Job[]) {
        await mkdir(this.batchDir, { recursive: true });
        const org = Utilities.ORGS[key] || key;
        const batchFile = path.join(this.batchDir, `${org}.json`);
        
        let batchData: Record<string, Job[]> = {};
        try {
            const existingData = await readFile(batchFile, 'utf-8');
            batchData = JSON.parse(existingData);
        } catch {
            // File doesn't exist yet, start fresh
        }
        
        if (!batchData[org]) {
            batchData[org] = [];
        }
        
        const existingIds = new Set(
            batchData[org].map((job: Job) => job.id)
        );
        
        for (const job of jobs) {
            if (!existingIds.has(job.id)) {
                batchData[org].push(job);
                existingIds.add(job.id);
            }
        }
        
        await writeFile(batchFile, JSON.stringify(batchData, null, 2));
    }

    /**
     * Consolidates all batch files into the main jobResults.json.
     * Call this once after all parallel tests complete.
     * Deduplicates across all batch files and existing records.
     */
    async consolidateBatchWrites() {
        let mainData: Record<string, any> = {};
        
        try {
            const mainFileData = await readFile(this.filePath, 'utf-8');
            mainData = JSON.parse(mainFileData);
        } catch {
            // jobResults.json doesn't exist yet, start with empty object
            mainData = {};
        }
        
        try {
            await Utilities.readdirSync(this.batchDir);
            // Batch directory exists, proceed with consolidation
        } catch {
            // Batch directory doesn't exist, nothing to consolidate
            return;
        }
        
        // Create reverse lookup: org name -> site ID
        const reverseOrgs = Object.fromEntries(
            Object.entries(Utilities.ORGS).map(([id, org]) => [org, id])
        );
        
        // Read all batch files and merge
        try {
            const files = await Utilities.readdirSync(this.batchDir);
            for (const file of files) {
                if (!file.endsWith('.json')) continue;
                
                const batchFile = path.join(this.batchDir, file);
                const batchData = JSON.parse(
                    await readFile(batchFile, 'utf-8')
                );
                
                for (const [org, batchJobs] of Object.entries(batchData)) {
                    if (!mainData[org]) {
                        const siteId = reverseOrgs[org];
                        mainData[org] = {
                            Site: org,
                            URL: siteId ? Utilities.URLS[siteId] || '' : '',
                            jobs: [],
                        };
                    }
                    
                    const existingIds = new Set(
                        mainData[org].jobs.map((job: Job) => job.id)
                    );
                    
                    for (const job of batchJobs as Job[]) {
                        if (!existingIds.has(job.id)) {
                            mainData[org].jobs.push(job);
                            existingIds.add(job.id);
                        }
                    }
                }
            }
        } catch {
            // Error reading batch directory, skip consolidation
            return;
        }
        
        await writeFile(this.filePath, JSON.stringify(mainData, null, 2));
        
        // Clean up batch directory
        try {
            for (const file of await Utilities.readdirSync(this.batchDir)) {
                await import('fs/promises')
                    .then(fs => fs.unlink(path.join(this.batchDir, file)));
            }
            await import('fs/promises')
                .then(fs => fs.rmdir(this.batchDir));
        } catch {
            // Ignore cleanup errors
        }
    }

    /**
     * Writes new jobs to a shared JSON file (deduped by job.id).
     * For serial test execution only. Use batchAppendJobs() for parallel tests.
     *
     * @param key provider site key used to map org and URL fields.
     * @param jobs normalized job list to append to existing records.
     */
    async writeJobs(key: string, jobs: Job[]) {
        const fileData = await readFile(this.filePath, 'utf-8');
        const data = JSON.parse(fileData);
        const org = Utilities.ORGS[key] || key;
        const url = Utilities.URLS[key] || '';
        if (!data[org]) {
            data[org] = {
                Site: '',
                URL: url,
                jobs: [],
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
    
    /**
     * Utility to read directory in synchronous manner.
     */
    private static async readdirSync(dir: string): Promise<string[]> {
        const fs = await import('fs/promises');
        return fs.readdir(dir);
    }

    /**
     * Normalizes raw job data into the standard output shape used by all providers.
     *
     * @param jobs raw jobs with minimal required fields (id/title/link).
     * @returns normalized jobs with status/date/notes default values.
     */
    async normalizeJobs(jobs: JobInput[]): Promise<Job[]> {
        const today = new Date().toISOString().split('T')[0];
        return jobs
            .filter(job => !!job.id && !!job.title && !!job.link)
            .map(job => ({
                id: job.id,
                title: job.title,
                link: job.link,
                status: '0',
                date: today,
                notes: '',
            }));
    }

    /**
     * Fetches all configured sites for a specific provider identifier.
     *
     * @param provider provider name as appears in test-data/sites.json (e.g. "schoolspring").
     * @returns filtered array of site definitions.
     */
    static getSitesByProvider(provider: string) {
        return [
            ...sites.Private,
            ...sites.Public,
            ...sites.Universities,
            ...sites.Sites,
            ...sites.Recruiters,
        ].filter(site => site.Provider === provider);
    }

    static URLS = Object.fromEntries(
        [
            ...sites.Private,
            ...sites.Public,
            ...sites.Universities,
            ...sites.Sites,
            ...sites.Recruiters,
        ].map(x => [x.id, x.URL])
    );

    static ORGS: Record<string, string> = Object.fromEntries(
        [
            ...sites.Private,
            ...sites.Public,
            ...sites.Universities,
            ...sites.Sites,
            ...sites.Recruiters,
        ].map(x => [x.id, x.org])
    );
}
