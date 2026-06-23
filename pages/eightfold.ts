import { Page } from '@playwright/test';
import { Job, JobDetails, Utilities } from '@classes/utilities';

export class Eightfold {
    page: Page;
    domain: string;
    baseUrl: string;

    /**
     * @param {Page} page - Playwright page instance
     * @param {string} subdomain - Eightfold subdomain used to construct the base URL
     * @param {string} domain - Eightfold domain parameter for API queries
     */
    constructor(page: Page, subdomain: string, domain: string) {
        this.page = page;
        this.domain = domain;
        this.baseUrl = `https://${subdomain}.eightfold.ai`;
    }

    /**
     * Builds the Eightfold search URL with query and filter parameters.
     * @param {Record<string, string | string[]>} params - Search filters
     * @param {number} [start=0] - Pagination offset
     * @returns {string} Constructed search API URL
     */
    buildUrl(params: Record<string, string | string[]>, start = 0): string {
        const q = new URLSearchParams();
        q.set('domain', this.domain);
        q.set('query', '');
        q.set('location', '');
        q.set('start', String(start));
        q.set('sort_by', 'timestamp');
        for (const [k, v] of Object.entries(params)) {
            if (k === 'query' || k === 'location') {
                q.set(k, Array.isArray(v) ? v[0] : v);
            } else if (Array.isArray(v)) {
                v.forEach(val => q.append(k, val));
            } else {
                q.set(k, v);
            }
        }
        return `${this.baseUrl}/api/pcsx/search?${q.toString()}`;
    }

    /**
     * Fetches job listings from Eightfold using pagination.
     * Continues until all results are retrieved or the API signals completion.
     * @param {Record<string, string | string[]>} [params={}] - Search filters
     * @returns {Promise<Job[]>} Normalized job list
     */
    async getJobs(params: Record<string, string | string[]> = {}): Promise<Job[]> {
        const rawJobs: Array<{
            id: string;
            title: string;
            link: string
        }> = [];
        const pageSize = 10;
        let start = 0;
        let totalCount = Infinity;

        while (start < totalCount) {
            const url = this.buildUrl(params, start);
            const response = await this.page.goto(url);
            const json = await response?.json();
            if (json.status !== 200) {
                console.error(`API request failed with status: ${json.status}`);
                return [];
            }
            if (start === 0) {
                totalCount = json.data.count;
                if (totalCount === 0) break;
            }
            const positions = json.data.positions;
            if (!positions.length) break;
            for (const pos of positions) {
                rawJobs.push({
                    id: String(pos.id),
                    title: pos.name,
                    link: `${this.baseUrl}/careers?pid=${pos.id}`,
                });
            }
            start += pageSize;
        }
        return Utilities.normalizeJobs(rawJobs);
    }
    /**
     * Builds a normalized single job entry when the exact position ID is known.
     * @param {string} title - Job title
     * @param {string} jobId - Eightfold position ID
     * @returns {Promise<Job[]>} Single normalized job array
     */
    async getSingleJob(title: string, jobId: string): Promise<Job[]> {
        const rawJobs: Array<{
            id: string;
            title: string;
            link: string
        }> = [];
        rawJobs.push({
            id: jobId,
            title: title,
            link: `${this.baseUrl}/careers?pid=${jobId}`,
        });
        return Utilities.normalizeJobs(rawJobs);

    }    
    /**
     * Builds the Eightfold position details URL.
     * @param {string} positionId - Position identifier
     * @param {string} [domain] - Optional domain override
     * @returns {string} Position details API URL
     */
    buildDetailsUrl(
        positionId: string,
        domain?: string,
        ): string {
        const q = new URLSearchParams();
        q.set('position_id', positionId);
        q.set('domain', domain || this.domain);
        q.set('hl', 'en');
        return `${this.baseUrl}/api/pcsx/position_details?${q.toString()}`;
    }

    /**
     * Fetches job details for a set of jobs or a site identifier.
     * If a site ID is provided, loaded job IDs are resolved via Utilities.getSiteJobIds.
     * @param {string | string[] | Job[]} siteIdOrJobs - Site ID, job IDs, or Job objects
     * @returns {Promise<JobDetails[]>} Array of normalized job details
     */
    async jobDetails(siteIdOrJobs: string | string[] | Job[]): Promise<JobDetails[]> {
        const rawDetails: Array<{
            title: string;
            displayJobId: string;
            department: string;
            location: string;
            worksite: string;
            description: string;
            entityId: string;
        }> = [];

        const ids = Array.isArray(siteIdOrJobs)
            ? Array.from(new Set(
                (siteIdOrJobs as Array<string | Job>).map(item =>
                    typeof item === 'string' ? item : item.id
                )
            ))
            : await Utilities.getSiteJobIds(siteIdOrJobs) as string[];
        const count = ids.length;
        for (let i = 0; i < count; i++) {
            const url = this.buildDetailsUrl(ids[i]);
            const response = await this.page.goto(url);
            const json = await response?.json();
            if (json.status !== 200) {
                console.error(`API request failed with status: ${json.status}`);
                return [];
            }
            const pos = json.data;
            rawDetails.push({
                title: pos.name,
                displayJobId: String(pos.displayJobId),
                department: pos.department,
                location: pos.locations,
                worksite: pos.workLocationOption,
                description: convertHtml(pos.jobDescription),
                entityId: String(pos.id),
            });
        }
        return rawDetails;
    }
    /**
     * Fetches details for a single Eightfold job by ID and domain.
     * @param {string} jobId - Job identifier
     * @param {string} domain - Eightfold domain parameter
     * @returns {Promise<JobDetails[]>} Array containing one job detail record
     */
    async singleJobDetails(jobId: string, domain: string): Promise<JobDetails[]> {
        const rawDetails: Array<{
            title: string;
            displayJobId: string;
            department: string;
            location: string;
            worksite: string;
            description: string;
            entityId: string;
        }> = [];

        const url = this.buildDetailsUrl(jobId, domain);
        const response = await this.page.goto(url);
        const json = await response?.json();
        if (json.status !== 200) {
            console.error(`API request failed with status: ${json.status}`);
            return [];
        }
        const pos = json.data;
        rawDetails.push({
            title: pos.name,
            displayJobId: String(pos.displayJobId),
            department: pos.department,
            location: pos.locations,
            worksite: pos.workLocationOption,
            description: convertHtml(pos.jobDescription),
            entityId: String(pos.id),
        });
        return rawDetails;
    }
}

function convertHtml(htmlString: string): string {
    return htmlString
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/&#13;/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&ndash;/gi, ' - ')
        .replace(/&amp;/gi, '&')
        .replace(/&nbsp;/g, '')
        .trim();
}
