import { Page } from '@playwright/test';
import { Job, JobDetails, Utilities } from '@classes/utilities';

export class OracleRecruiting {
    page: Page;
    id: string;
    url: string;
    baseUrl: string;
    locale: string;
    siteNumber: string;
    noAdmin: boolean;

    constructor(page: Page, id?: string) {
        this.page = page;
        this.id = id || '';
        this.noAdmin = false;
        this.url = Utilities.URLS[this.id];
        const match = this.url.match(
            /^(https?:\/\/[^/]+)\/hcmUI\/CandidateExperience\/([^/]+)\/sites\/([^/?#]+)/
        );
        this.baseUrl = match ? match[1] : '';
        this.locale = match ? match[2] : 'en';
        this.siteNumber = match ? match[3] : '';
    }

    /**
     * Builds the Oracle Cloud Recruiting (Fusion HCM) job search API URL.
     * @param {string} [keyword=''] - Search term
     * @param {number} [limit=25] - Page size
     * @param {number} [offset=0] - Pagination offset
     * @returns {string} Search API URL
     */
    buildJobsUrl(keyword = '', limit = 25, offset = 0): string {
        const finder =
            `findReqs;siteNumber=${this.siteNumber},facetsList=LOCATIONS,` +
            `limit=${limit},offset=${offset},keyword=${encodeURIComponent(keyword)},` +
            `sortBy=POSTING_DATES_DESC`;
        const q = new URLSearchParams();
        q.set('onlyData', 'true');
        q.set('expand', 'all');
        q.set('finder', finder);
        return `${this.baseUrl}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?${q.toString()}`;
    }

    /**
     * Builds the Oracle Cloud Recruiting job details API URL.
     * @param {string} jobId - Requisition ID
     * @returns {string} Details API URL
     */
    buildDetailsUrl(jobId: string): string {
        const finder = `ById;Id="${jobId}",siteNumber=${this.siteNumber}`;
        const q = new URLSearchParams();
        q.set('onlyData', 'true');
        q.set('expand', 'all');
        q.set('finder', finder);
        return `${this.baseUrl}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?${q.toString()}`;
    }

    async searchPage() {
        const response = await this.page.goto(this.buildJobsUrl());
        const data = await response?.json();
        const count = data?.items?.[0]?.TotalJobsCount ?? 0;
        if (!count) {
            this.noAdmin = true;
        }
    }

    /**
     * Fetches job listings from the Oracle Cloud Recruiting search API, paginating
     * until all results for the search term have been retrieved.
     * @param {string} [searchTerm=''] - Search term
     * @returns {Promise<Job[]>} Normalized job list
     */
    async getJobs(searchTerm = ''): Promise<Job[]> {
        const rawJobs: Array<{ id: string; title: string; link: string }> = [];
        const pageSize = 25;
        let offset = 0;
        let totalCount = Infinity;

        while (offset < totalCount) {
            const response = await this.page.goto(this.buildJobsUrl(searchTerm, pageSize, offset));
            const data = await response?.json() as any;
            const item = data?.items?.[0];
            if (!item) {
                console.error('Oracle Cloud Recruiting search request returned no data.');
                break;
            }
            if (offset === 0) {
                totalCount = item.TotalJobsCount ?? 0;
                if (!totalCount) break;
            }
            const reqs = item.requisitionList || [];
            if (!reqs.length) break;
            for (const req of reqs) {
                if (!ageValid(req.PostedDate)) {
                    console.warn('Job age exceeds threshold, skipping job extraction.');
                    continue;
                }
                rawJobs.push({
                    id: String(req.Id),
                    title: req.Title,
                    link: `${this.baseUrl}/hcmUI/CandidateExperience/${this.locale}/sites/${this.siteNumber}/job/${req.Id}`,
                });
            }
            offset += pageSize;
        }
        return Utilities.normalizeJobs(rawJobs);
    }

    /**
     * Fetches job detail records for the given jobs.
     * @param {Job[]} jobs - Jobs to fetch details for
     * @returns {Promise<JobDetails[]>} Detailed job records
     */
    async jobDetails(jobs: Job[]): Promise<JobDetails[]> {
        const rawDetails = [] as Array<{
            title: string;
            displayJobId: string;
            department: string;
            description: string;
            entityId: string;
        }>;
        const ids = Array.from(new Set(jobs.map(job => job.id)));

        for (const id of ids) {
            const response = await this.page.goto(this.buildDetailsUrl(id));
            const data = await response?.json() as any;
            const item = data?.items?.[0];
            if (!item) {
                console.error(`Oracle Cloud Recruiting details request failed for id: ${id}`);
                continue;
            }
            rawDetails.push({
                title: item.Title,
                displayJobId: String(item.JobId ?? item.Id),
                department: item.JobFunction || item.OrganizationDescription || '',
                description: convertHtml(item.ExternalDescriptionStr || item.ShortDescriptionStr || ''),
                entityId: String(item.Id),
            });
        }
        return rawDetails;
    }
}

/**
 * Checks whether a job's posted date is within the freshness threshold.
 * @param {string} [postedDate] - ISO date string from the API
 * @returns {boolean} True if the job was posted fewer than 450 days ago
 */
function ageValid(postedDate?: string): boolean {
    if (!postedDate) return false;
    const posted = new Date(postedDate);
    if (isNaN(posted.getTime())) return false;
    const ageDays = (Date.now() - posted.getTime()) / (1000 * 60 * 60 * 24);
    return ageDays < 450;
}

function convertHtml(htmlString: string): string {
    return htmlString
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/&#13;/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&ndash;/gi, ' - ')
        .replace(/&amp;/gi, '&')
        .replace(/&nbsp;/g, ' ')
        .trim();
}
