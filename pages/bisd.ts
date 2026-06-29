import { Locator, Page } from '@playwright/test';
import { Job, JobDetails, Utilities } from '@classes/utilities';

export class BISD {
    page: Page;
    url: string;
    domain: string;
    orgs: string;
    loginLink: Locator;
    userMenu: Locator;
    googleButton: Locator;
    googleUsername: Locator;
    googleNextButton: Locator;
    googlePassword: Locator;
    googleContinueButton: Locator;
    popupPromise: Promise<Page>;

    constructor(
        page: Page,
    ) {
        this.page = page;
        this.url = Utilities.URLS['I001'];
        this.domain = Utilities.DOMAINS['I001'];
        this.orgs = Utilities.ORGS['I001'];
        this.loginLink = page.locator('.candidate-login-link');
        this.userMenu = page.getByRole('button', { name: 'User Menu' });
        this.googleButton = this.page.getByRole('button', { name: /google/i });
        this.googleUsername = this.page.getByRole('textbox', { name: 'Email or phone' });
        this.googlePassword = this.page.getByRole('textbox', { name: 'Enter your password' });
        this.googleNextButton = this.page.getByRole('button', { name: 'Next' });
        this.googleContinueButton = this.page.getByRole('button', { name: 'Continue' });
        this.popupPromise = page.waitForEvent('popup');
    };

    async searchPage() {
        await this.page.goto(this.url);
    }

    async login(email: string, password: string) {
        await this.loginLink.click();
        await this.page.waitForURL(
            url => url.href.includes('careerhub'),
            { timeout: 15000 }
        );
        if (await this.userMenu.isVisible()) {
            return;
        }
        await this.page.waitForSelector('[data-testid="auth-entry-title"]', { timeout: 15000 });
        if (await this.googleButton.isVisible()) {
            await this.googleButton.click();
        }
        const popup = await this.popupPromise;
        await popup.waitForURL('**/accounts.google.com**');
        if (await popup.locator(`[data-identifier="${email}"]`).isVisible()) {
            await popup.locator(`[data-identifier="${email}"]`).click();
            await popup.getByRole('button', { name: 'Continue' }).click();
        } else {
            await popup.waitForLoadState('domcontentloaded');
            await popup.getByRole('textbox', { name: 'Email or phone' }).fill(email);
            await popup.getByRole('button', { name: 'Next' }).click();
            await popup.getByRole('textbox', { name: 'Enter your password' }).fill(password);
            await popup.getByRole('button', { name: 'Next' }).click();
            await popup.getByRole('button', { name: 'Continue' }).click();
            await popup.waitForEvent('close', { timeout: 15000 });
        }
        await this.page.waitForURL(
            url => url.href.includes('careerhub'),
            { timeout: 15000 }
        );
    }

    /**
     * Builds the BISD search API URL with filters and pagination.
     * @param {Record<string, string | string[]>} params - Filter parameters
     * @param {string} [query=''] - Search query term
     * @param {number} [pageSize=100] - Maximum results per page
     * @returns {string} Search API URL
     */
    buildJobsUrl(params: Record<string, string | string[]>, query = '', pageSize = 100): string {
        const q = new URLSearchParams();
        q.set('search_data_id', 'search');
        q.set('page_size', String(pageSize));
        q.set('start', '0');
        q.set('query', String(query));
        q.set('recommended', '0');
        q.set('domain', this.domain);
        q.set('exclude_entities_outside_location', 'false');
        q.set('caller_id', 'ch_marketplace:position');
        q.set('prefill_first_record', 'false');

        for (const [k, v] of Object.entries(params)) {
            if (Array.isArray(v)) {
                v.forEach(val => q.append(k, val));
            } else {
                q.set(k, v);
            }
        }
        return `${this.url}/api/career_hub/v1/search/position?${q.toString()}`;
    }

    /**
     * Fetches filtered jobs from the BISD search API.
     * Adjusts page size to cover the total count when needed.
     * @param {string} searchTerm - Search string
     * @param {Record<string, string | string[]>} [params={}] - Additional API filters
     * @returns {Promise<Job[]>} Array of normalized jobs
     */
    async getJobs(searchTerm: string, params: Record<string, string | string[]> = {}): Promise<Job[]> {
        const rawJobs = [] as Array<{
            id: string;
            title: string;
            link: string;
        }>;
        let pageSize = 100;
        let query = searchTerm;
        const url = this.buildJobsUrl(params, query, pageSize);
        let response = await this.page.goto(url);
        let json = await response?.json();
        let data = json.data;
        if (json.status !== 200) {
            console.error(`API request failed with status: ${json.status}`);
            return [];
        }
        const count = data.pagination.totalCount;
        if (count > pageSize) {
            console.warn(`${count} results exceeds page size. Increasing page size.`);
            const newUrl = this.buildJobsUrl(params, query, count);
            response = await this.page.goto(newUrl);
            json = await response?.json();
            data = json.data;
            if (json.status !== 200) {
                console.error(`API request failed with status: ${json.status}`);
                return [];
            }
        }

        for (let i = 0; i < count; i++) {
            const ageText = data.results[i].postedDate;
            const ageDays = ageText?.match(/\d+/);
            const ageValid = ageDays ? parseInt(ageDays[0], 10) < 450 : false;
            if (!ageValid) {
                console.warn('Job age exceeds threshold, skipping job extraction.');
                continue;
            }
            const job = data.results[i].entityId;
            const title = data.results[i].title;
            const link = data.results[i].exploreJobUrl;
            const id: string | undefined = job?.match(/\d+/)?.[0];
            if (!id) continue;
            rawJobs.push({ id, title, link });
        }
        return Utilities.normalizeJobs(rawJobs);
    }

    /**
     * Builds the BISD position details API URL.
     * @param {Record<string, string | string[]>} params - Query parameters
     * @param {string} [jobId=''] - Position ID
     * @returns {string} Details API URL
     */
    buildDetailsUrl(params: Record<string, string | string[]>, jobId = ''): string {
        const q = new URLSearchParams();
        q.set('search_data_id', 'search');
        q.set('domain', this.domain);
        q.set('caller_id', 'ch_marketplace_details:position');

        for (const [k, v] of Object.entries(params)) {
            if (Array.isArray(v)) {
                v.forEach(val => q.append(k, val));
            } else {
                q.set(k, v);
            }
        }

        return `${this.url}/api/career_hub/v1/entity/position/${jobId}?${q.toString()}`;
    }

    /**
     * Fetches job detail records by site ID, job IDs array, or Job objects.
     * @param {string | string[] | Job[]} siteIdOrJobs - Site ID or collection of jobs/IDs
     * @param {Record<string, string | string[]>} [params={}] - Additional detail query parameters
     * @returns {Promise<JobDetails[]>} Detailed job records
     */
    async jobDetails(
        siteIdOrJobs: string | string[] | Job[],
        params: Record<string, string | string[]> = {}): Promise<JobDetails[]> {
        const rawDetails = [] as Array<{
            title: string;
            displayJobId: string;
            department: string;
            description: string;
            entityId: string;
        }>;
        const ids = Array.isArray(siteIdOrJobs)
            ? Array.from(new Set(
                (siteIdOrJobs as Array<string | Job>).map(item =>
                    typeof item === 'string' ? item : item.id
                )
            ))
            : await Utilities.getSiteJobIds(siteIdOrJobs) as string[];
        const count = ids.length;
        for (let i = 0; i < count; i++) {
            const jobUrl = this.buildDetailsUrl(params, ids[i]);
            const response = await this.page.goto(jobUrl);
            const json = await response?.json();
            if (json.status !== 200) {
                console.error(`API request failed with status: ${json.status}`);
                return [];
            }
            const details = json.data.dataIds.details;
            const rawDescription = details.description;
            const title = details.title;
            const displayJobId = details.displayJobId;
            const department = details.department;
            const description = convertHtml(rawDescription);
            const entityId = ids[i];
            rawDetails.push({ title, displayJobId, department, description, entityId });
        }
        return rawDetails;
    }
}

    function convertHtml(htmlString: string): string {
        return htmlString
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/\&\#13\;/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/\&ndash\;/gi, ' - ')
        .replace(/\&amp\;/gi, '&')
        .replace(/\&nbsp\;/g, '')
        .trim();
}