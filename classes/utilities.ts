import { readFile, writeFile, mkdir, readdir, unlink, rmdir } from 'fs/promises';
import path from 'path';
import sites from '../test-data/sites.json';
import filters from '../test-data/filters.json';

// ─────────────────────────────────────────────
// SECTION 1: Types / Interfaces
// ─────────────────────────────────────────────

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

interface SiteEntry {
    id: string;
    URL: string;
    domain: string;
    org: string;
    Provider: string;
}

export class Utilities {

    // ─────────────────────────────────────────────
    // SECTION 2: Static Lookup Maps
    // ─────────────────────────────────────────────

    private static readonly ALL_SITES = [
        ...sites.Private,
        ...sites.Public,
        ...sites.Universities,
        ...sites.Sites,
        ...sites.Recruiters,
        ...sites.Employers,
    ];

    private static readonly ALL_EIGHTFOLD = Object.values(
        filters as Record<string, EightfoldSite>
    );

    static readonly URLS = Object.fromEntries(
        [
            ...Utilities.ALL_SITES as SiteEntry[],
            ...Utilities.ALL_EIGHTFOLD.map(f => ({
                id: f.id, URL: f.baseUrl,
            })) as SiteEntry[],
        ].map((x: SiteEntry) => [x.id, x.URL]));

    static DOMAINS = Object.fromEntries(
        [
            ...Utilities.ALL_SITES as SiteEntry[],
            ...Utilities.ALL_EIGHTFOLD.map(f => ({
                id: f.id, domain: f.domain,
            })) as SiteEntry[],
        ].map((x: SiteEntry) => [x.id, x.domain]));

    static ORGS = Object.fromEntries(
        [
            ...Utilities.ALL_SITES as SiteEntry[],
            ...Utilities.ALL_EIGHTFOLD.map(f => ({
                id: f.id, org: f.org,
            })) as SiteEntry[],
        ].map((x: SiteEntry) => [x.id, x.org]));

    // ─────────────────────────────────────────────
    // SECTION 3: Static Path Constants
    // ─────────────────────────────────────────────

    static JOB_RESULTS_PATH = path.join(__dirname, '../test-data/jobResults.json');

    // ─────────────────────────────────────────────
    // SECTION 4: Static Query Methods (Site / Provider lookups)
    // ─────────────────────────────────────────────

    static async getSiteJobIds(siteId: string): Promise<string[]> {
        let results: Record<string, any> = {};
        try {
            const raw = await readFile(Utilities.JOB_RESULTS_PATH, 'utf-8');
            results = JSON.parse(raw);
        } catch {
            return [];
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
        return map[siteId] || [];
    }

    static getSitesByProvider(provider: string) {
        const fromSites = [
            ...Utilities.ALL_SITES,
        ].filter(site => site.Provider === provider);

        if (provider === 'eightfold') {
            const fromFilters = Utilities.ALL_EIGHTFOLD.map(f => ({
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

    // ─────────────────────────────────────────────
    // SECTION 5: Instance Properties
    // ─────────────────────────────────────────────

    filePath = path.join(__dirname, '../test-data/jobResults.json');
    batchDir = path.join(__dirname, '../test-data/.batch');

    // ─────────────────────────────────────────────
    // SECTION 5b: Private Helpers
    // ─────────────────────────────────────────────

    private mergeUnique<T>(
        existing: T[],
        incoming: T[],
        getId: (item: T) => string
    ): T[] {
        const seen = new Set(existing.map(getId));
        const result = [...existing];
        for (const item of incoming) {
            const id = getId(item);
            if (!seen.has(id)) {
                result.push(item);
                seen.add(id);
            }
        }
        return result;
    }

    // ─────────────────────────────────────────────
    // SECTION 6: Instance Methods — Job Normalization
    // ─────────────────────────────────────────────

    static async normalizeJobs(jobs: JobInput[]): Promise<Job[]> {
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

    // ─────────────────────────────────────────────
    // SECTION 7: Instance Methods — Batch I/O (primary write path)
    // ─────────────────────────────────────────────

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
        
        batchData[org] = this.mergeUnique(batchData[org], jobs, j => j.id);

        await writeFile(batchFile, JSON.stringify(batchData, null, 2));
    }

    async consolidateBatchWrites() {
        let mainData: Record<string, any> = {};
        
        try {
            const mainFileData = await readFile(this.filePath, 'utf-8');
            mainData = JSON.parse(mainFileData);
        } catch {
            mainData = {};
        }

        const reverseOrgs = Object.fromEntries(
            Object.entries(Utilities.ORGS).map(([id, org]) => [org, id])
        );

        let files: string[];
        try {
            files = await readdir(this.batchDir);
        } catch {
            return;
        }

        try {
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
                    mainData[org].jobs = this.mergeUnique(
                        mainData[org].jobs,
                        batchJobs as Job[],
                        j => j.id
                    );
                }
            }
        } catch {
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

    // ─────────────────────────────────────────────
    // SECTION 8: Instance Methods — Direct I/O
    // ─────────────────────────────────────────────
    
    async writeDetails(key: string, details: JobDetails[]) {
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

        const incoming = (details || []).map(detail => ({
            title: detail.title,
            JobID: detail.displayJobId,
            Department: detail.department,
            'URL entity': detail.entityId,
            Description: detail.description,
        }));
        data[org].jobs = this.mergeUnique(
            data[org].jobs || [],
            incoming,
            j => String(j.JobID)
        );
        await writeFile(detailsFile, JSON.stringify(data, null, 2));
    }

    /**
     * @deprecated Use {@link batchAppendJobs} instead.
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
            data[org] = { Site: org, URL: url, jobs: [] };
        }

        if (!Array.isArray(data[org].jobs)) {
            data[org].jobs = [];
        }

        data[org].Site = String(data[org].Site || org);
        data[org].URL = String(data[org].URL || url);

        data[org].jobs = this.mergeUnique(data[org].jobs, jobs, j => j.id);

        await writeFile(this.filePath, JSON.stringify(data, null, 2));
    }
}