import { Locator, Page } from '@playwright/test';
import { Job, JobDetails, Utilities } from '@classes/utilities';

export class BISD {
    page: Page;
    utils: Utilities;
    url: string;
    domain: string;
    orgs: string;
    loginLink: Locator;
    username: Locator;
    usernameButton: Locator;
    password: Locator;
    submitButton: Locator;
    userMenu: Locator;

    constructor(
        page: Page,
    ) {
        this.page = page;
        this.utils = new Utilities();
        this.url = Utilities.URLS['I001'];
        this.domain = Utilities.DOMAINS['I001'];
        this.orgs = Utilities.ORGS['I001'];
        this.loginLink = page.locator('.candidate-login-link');
        this.username = page.getByTestId('auth-entry-email-input');
        this.usernameButton = page.getByRole('button', { name: 'Continue' });
        this.password = page.getByTestId('auth-entry-password-input');
        this.submitButton = page.getByRole('button', { name: 'Submit' })
        this.userMenu = page.getByRole('button', { name: 'User Menu' });
    };

    async searchPage() {
        await this.page.goto(this.url);
    }

    async login(email: string, password: string) {
        await this.loginLink.click();
        await this.username.fill(email);
        await this.usernameButton.click();
        await this.password.fill(password);
        await this.submitButton.click();
        await this.userMenu.isVisible();
        await this.page.waitForLoadState('networkidle');
        const currentUrl = this.page.url();
        if (!currentUrl.includes('careerhub')) {
            console.warn(currentUrl, 'Documenting in case login failed.');
        }
    }

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
        return this.utils.normalizeJobs(rawJobs);
    }

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

    async jobDetails(siteIdOrJobs: string | string[] | Job[], params: Record<string, string | string[]> = {}): Promise<JobDetails[]> {
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