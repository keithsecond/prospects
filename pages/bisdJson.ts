import { Locator, Page, expect } from '@playwright/test';
import { Job, Utilities } from '@classes/utilities';

export class BISD {
    page: Page;
    utils: Utilities;
    url: string;
    domain: string;
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
    }

    buildUrl(params: Record<string, string | string[]>, query = '', pageSize = 100): string {
        const q = new URLSearchParams();
        q.set('search_data_id', 'search');
        q.set('page_size', String(pageSize));
        q.set('start', '0');
        q.set('query', String(query));
        q.set('recommended', '0');
        q.set('domain', this.domain);
        q.set('exclude_entities_outside_location', 'false');
        q.set('caller_id', 'ch_marketplace%3Aposition');
        q.set('prefill_first_record', 'false');
        for (const [k, v] of Object.entries(params)) {
            if (Array.isArray(v)) v.forEach(val => q.append(k, val));
            else q.set(k, v);
        }
        return `${this.url}/api/career_hub/v1/search/position?${q.toString()}`;
    }

    async getJobs(searchTerm: string, params: Record<string, string | string[]> = {}): Promise<Job[]> {
        const rawJobs = [] as Array<{
            id: string;
            title: string;
            link: string;
        }>;
        let start = 0;
        let pageSize = 100;
        let query = searchTerm;
        const url = this.buildUrl(params, query, pageSize);
        let response = await this.page.goto(url);
        let jsonData = await response?.json();
        let data = jsonData.data;
        if (jsonData.status !== 200) {
            console.error(`API request failed with status: ${jsonData.status}`);
            return [];
        }
        const count = data.pagination.totalCount;
        if (count > pageSize) {
            console.warn(`${count} results exceeds page size. Increasing page size.`);
            const newUrl = this.buildUrl(params, query, count);
            response = await this.page.goto(newUrl);
            jsonData = await response?.json();
            data = jsonData.data;
            if (jsonData.status !== 200) {
                console.error(`API request failed with status: ${jsonData.status}`);
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

    async jobDetails(jobId: string): Promise<string> {
        const domain = this.domain;
        const queryUrl = `${this.url}/api/career_hub/v1/entity/position/${jobId}?entity_sections=details&domain=${domain}&caller_id=ch_marketplace_details%3Aposition`;
        const response = await this.page.goto(queryUrl);
        const jsonData = await response?.json();
        if (jsonData.status !== 200) {
            console.error(`API request failed with status: ${jsonData.status}`);
            return '';
        }
        const details = jsonData.data.dataIds.details;
        const description = details.description;
        const cleanDescription = convertHtml(description);
        return cleanDescription;
    }
}

function convertHtml(htmlString: string): string {
    return htmlString
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/\&\#13\;/gi, '\n')
        .replace(/\&ndash\;/gi, ' - ')
        .replace(/\&amp\;/gi, '&')
        .replace(/\&nbsp\;/g, '')
        .replace(/<[^>]*>/g, '')
        .trim();
}