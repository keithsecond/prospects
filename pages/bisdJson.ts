import { Locator, Page, expect } from '@playwright/test';
import { Job, Utilities } from '@classes/utilities';
import { json } from 'node:stream/consumers';

export class BISD {
    page: Page;
    utils: Utilities;
    url: string;
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
        this.url = Utilities.URLS["I001"];
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

    async getJobs(searchTerm: string): Promise<Job[]> {
        const rawJobs = [] as Array<{
            id: string;
            title: string;
            link: string;
        }>;
        let start = 0;
        let pageSize = 100;
        const hostParts = this.url.replace('https://', '').split('.');
        const companyDomain = hostParts.slice(1).join('.');
        let queryUrl = `${this.url}/api/career_hub/v1/search/position?search_data_id=search&start=${start}&page_size=${pageSize}&entity_id=&query=${searchTerm}&recommended=0&display_filters=%7B%7D&domain=${companyDomain}&exclude_entities_outside_location=false&caller_id=ch_marketplace%3Aposition&prefill_first_record=false`;
        let response = await this.page.goto(queryUrl);
        let jsonData = await response?.json();
        let data = jsonData.data;
        console.log(jsonData.status, "status");
        if (jsonData.status !== 200) {
            console.error(`API request failed with status: ${jsonData.status}`);
            return [];
        }
        const count = data.pagination.totalCount;
        console.log(`Search for "${searchTerm}" returned ${count} results ${pageSize}`);
        if (count > pageSize) {
            console.warn(`${count} results exceeds page size. Increasing page size.`);
            queryUrl = `${this.url}/api/career_hub/v1/search/position?search_data_id=search&start=${start}&page_size=${count}&entity_id=&query=${searchTerm}&recommended=0&display_filters=%7B%7D&domain=${companyDomain}&exclude_entities_outside_location=false&caller_id=ch_marketplace%3Aposition&prefill_first_record=false`;
            response = await this.page.goto(queryUrl);
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
        const hostParts = this.url.replace('https://', '').split('.');
        const companyDomain = hostParts.slice(1).join('.');
        const queryUrl = `${this.url}/api/career_hub/v1/entity/position/${jobId}?entity_sections=details&domain=${companyDomain}&caller_id=ch_marketplace_details%3Aposition`;
        const response = await this.page.goto(queryUrl);
        const jsonData = await response?.json();
        if (jsonData.status !== 200) {
            console.error(`API request failed with status: ${jsonData.status}`);
            return '';
        }
        const details = jsonData.data.dataIds.details;
        const description = details.description;
        const cleanDescription = convertHtml(description);
        console.log(cleanDescription, details.displayJobId);
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