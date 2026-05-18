import { readFile, writeFile, mkdir, readdir, unlink, rmdir } from 'fs/promises';
import path from 'path';
import sites from '../test-data/sites.json';
import filters from '../test-data/filters.json';

export type Job = {
    id: string;
    title: string;
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

export type JobDetails = {
    title: string;
    displayJobId: string;
    department: string;
    description: string;
    entityId: string;
};

export type EightfoldSite = {
    id: string;
    org: string;
    subdomain: string;
    domain: string;
    baseUrl: string;
    filters: Record<string, string | string[]>;
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
            mainData = {};
        }
        
        try {
            await Utilities.readdirSync(this.batchDir);
            // Batch directory exists, proceed with consolidation
        } catch {
            return;
        }

        const reverseOrgs = Object.fromEntries(
            Object.entries(Utilities.ORGS).map(([id, org]) => [org, id])
        );

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
        
        try {
            const files = await readdir(this.batchDir);
            for (const file of files) {
                await unlink(path.join(this.batchDir, file));
            }
            await rmdir(this.batchDir);
        } catch (err) {
            console.error('Failed to clean up batch directory:', err);
        }
    }

    /**
     * Writes new jobs directly to jobResults.json (deduped by job.id).
     *
     * @deprecated Use {@link batchAppendJobs} instead. Direct writes are unsafe
     * under parallel execution and bypass the consolidation step in globalTeardown.
     * Retained for one-shot debugging only.
     *
     * @param key provider site key used to map org and URL fields.
     * @param jobs normalized job list to append to existing records.
    */

    async writeJobs(key: string, jobs: Job[]) {
        let data: Record<string, any> = {};
        try {
            const fileData = await readFile(this.filePath, 'utf-8');
            data = JSON.parse(fileData);
        } catch {
            data = {};
        }

        const org = Utilities.ORGS[key] || key;
        const url = Utilities.URLS[key] || '';

        if (!data[org] || typeof data[org] !== 'object') {
            data[org] = {
                Site: org,
                URL: url,
                jobs: [],
            };
        }

        if (!Array.isArray(data[org].jobs)) {
            data[org].jobs = [];
        }

        data[org].Site = String(data[org].Site || org);
        data[org].URL = String(data[org].URL || url);

        const existingJobIds = new Set(
            data[org].jobs.map((job: Job) => job.id)
        );

        for (const job of jobs) {
            if (!existingJobIds.has(job.id)) {
                data[org].jobs.push(job);
                existingJobIds.add(job.id);
            }
        }

        await writeFile(this.filePath, JSON.stringify(data, null, 2));
    }
    
    /**
     * Writes job details to a per-org details JSON file.
     * File path: ../test-data/<org>.description.json
     *
     * @param key provider site key used to map org and filename.
     * @param details array returned from page.jobDetails()
     */
    async writeDetails(key: string, details: Array<any>) {
        const org = Utilities.ORGS[key] || key;
        const detailsFile = path.join(__dirname, `../test-data/description/${org}.description.json`);

        let data: Record<string, { jobs: any[] }> = {};
        try {
            const existing = await readFile(detailsFile, 'utf-8');
            data = JSON.parse(existing);
        } catch {
            data = {};
        }

        if (!data[org] || typeof data[org] !== 'object') {
            data[org] = { jobs: [] };
        }

        const existingIds = new Set(
            (data[org].jobs || []).map((j: any) => String(j.JobID))
        );

        for (const d of details || []) {
            const jobObj = {
                title: d.title,
                JobID: d.displayJobId,
                Department: d.department,
                'URL entity': d.entityId,
                Description: d.description,
            };

            if (!existingIds.has(String(jobObj.JobID))) {
                data[org].jobs.push(jobObj);
                existingIds.add(String(jobObj.JobID));
            }
        }

        await writeFile(detailsFile, JSON.stringify(data, null, 2));
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

    static JOB_RESULTS_PATH = path.join(__dirname, '../test-data/jobResults.json');

    static async getSiteJobIds(siteId: string): Promise<Record<string, string[]> | string[]> {
        let results: Record<string, any> = {};
        try {
            const raw = await readFile(Utilities.JOB_RESULTS_PATH, 'utf-8');
            results = JSON.parse(raw);
        } catch {
            return siteId ? [] : {};
        }

        const reverseOrgs = Object.fromEntries(
            Object.entries(Utilities.ORGS)
                .map(([id, org]) => [String(org || '').trim(), id])
        );
        const map: Record<string, string[]> = {};
        for (const [key, entry] of Object.entries(results)) {
            if (key === 'Status Definitions') continue;
            const siteName = String((entry && (entry.Site || key)) || '').trim();
            if (!siteName) continue;

            let id = reverseOrgs[siteName];
            if (!id) {
                for (const [orgId, org] of Object.entries(Utilities.ORGS)) {
                    if (String(org || '').trim().toLowerCase() === siteName.toLowerCase()) {
                        id = orgId;
                        break;
                    }
                }
            }
            if (!id) continue;

            const jobs = Array.isArray((entry as any).jobs) ? (entry as any).jobs : [];
            map[id] = jobs.map((j: any) => String(j.id)).filter(Boolean);
        }
        return siteId ? (map[siteId] || []) : map;
    }

    /**
     * Returns the config for a single eightfold public site by its site id.
     *
     * @param siteId key matching a top-level entry in filters.json (e.g. "E010").
     * @returns EightfoldSite config or undefined if not found.
     */
    static getEightfoldSite(siteId: string): EightfoldSite | undefined {
        const entry = (filters as Record<string, EightfoldSite>)[siteId];
        return entry ?? undefined;
    }

    /**
     * Returns all eightfold public site configs from filters.json.
     *
     * @returns array of EightfoldSite configs.
     */
    static getEightfoldSites(): EightfoldSite[] {
        return Object.values(filters as Record<string, EightfoldSite>);
    }

    /**
     * Fetches all configured sites for a specific provider identifier.
     *
     * @param provider provider name as appears in test-data/sites.json.
     * @returns filtered array of site definitions.
     */
    static getSitesByProvider(provider: string) {
        const fromSites = [
            ...sites.Private,
            ...sites.Public,
            ...sites.Universities,
            ...sites.Sites,
            ...sites.Recruiters,
            ...sites.Employers,
        ].filter(site => site.Provider === provider);

        if (provider === 'eightfold') {
            const fromFilters = Object.values(filters as Record<string, EightfoldSite>)
                .map(f => ({
                    id: f.id,
                    org: f.org,
                    URL: f.baseUrl,
                    Provider: 'eightfold',
                    domain: f.domain,
                }));
            return [...fromSites, ...fromFilters];
        }

        return fromSites;
    }

    static URLS = Object.fromEntries([
        ...sites.Private,
        ...sites.Public,
        ...sites.Universities,
        ...sites.Sites,
        ...sites.Recruiters,
        ...sites.Employers,
        ...Object.values(filters as Record<string, EightfoldSite>).map(f => ({
            id: f.id, URL: f.baseUrl,
        })),
    ].map((x: any) => [x.id, x.URL]));

    static DOMAINS = Object.fromEntries([
        ...sites.Private,
        ...sites.Public,
        ...sites.Universities,
        ...sites.Sites,
        ...sites.Recruiters,
        ...sites.Employers,
        ...Object.values(filters as Record<string, EightfoldSite>).map(f => ({
            id: f.id, domain: f.domain,
        })),
    ].map((x: any) => [x.id, x.domain]));

    static ORGS: Record<string, string> = Object.fromEntries([
        ...sites.Private,
        ...sites.Public,
        ...sites.Universities,
        ...sites.Sites,
        ...sites.Recruiters,
        ...sites.Employers,
        ...Object.values(filters as Record<string, EightfoldSite>).map(f => ({
            id: f.id, org: f.org,
        })),
    ].map((x: any) => [x.id, x.org]));
}
