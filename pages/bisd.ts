import { Locator, Page, expect } from '@playwright/test';
import { Job, Utilities } from '@classes/utilities';

export class BISD {
    page: Page;
    utils: Utilities;
    loginLink: Locator;
    username: Locator;
    usernameButton: Locator;
    password: Locator;
    submitButton: Locator;
    userMenu: Locator;
    jobMenu: Locator;
    searchBox: Locator;
    searchDropdown: Locator;
    moreButton: Locator;
    moreFinish: Locator;
    age: Locator;
    container: Locator;
    jobCard: Locator;
    jobId: Locator;
    title: Locator;
    jobUrl: string;

    constructor(
        page: Page,
    ) {
        this.page = page;
        this.utils = new Utilities();
        this.loginLink = page.locator('.candidate-login-link');
        this.username = page.getByTestId('auth-entry-email-input');
        this.usernameButton = page.getByRole('button', { name: 'Continue' });
        this.password = page.getByTestId('auth-entry-password-input');
        this.submitButton = page.getByRole('button', { name: 'Submit' });
        this.userMenu = page.getByRole('button', { name: 'User Menu' });
        this.jobMenu = page.getByRole('menuitem', { name: 'Jobs' });
        this.searchBox = page.getByTestId('common-text-input-search-input');
        this.searchDropdown = page.getByRole('option').locator('.oct-body-2');
        this.moreButton = page.getByRole('button', { name: 'Load More Results' });
        this.moreFinish = page.locator('.info-bar');
        this.container = page.getByRole('list').locator('.cards-container-scroll-handler');
        this.jobCard = page.getByRole('listitem').locator('.common-entity-card-container.-card');
        this.age = page.locator('.body-text-3.job-info');
        this.jobId = page.locator('.position-displayJobId');
        this.title = page.locator('#entity-header-title');
        this.jobUrl = page.url();
    }

    async searchPage() {
        const url = Utilities.URLS["I001"];
        await this.page.goto(url);
    }

    async login(email: string, password: string) {
        await this.loginLink.click();
        await this.username.fill(email);
        await this.usernameButton.click();
        await this.password.fill(password);
        await this.submitButton.click();
        await this.userMenu.isVisible();
    }

    async search(searchTerm: string) {
        await this.jobMenu.click();
        await this.searchBox.fill(searchTerm);
        await this.searchBox.click();
        await this.searchDropdown.nth(0).click();
        while (!(await this.moreFinish.isVisible())) {
            if (await this.moreButton.isVisible()) {
                await this.moreButton.click();
            }
        }
    }

    async getJobs(searchTerm: string): Promise<Job[]> {
        const foundJobs = this.jobCard;
        const count = await foundJobs.count();
        const rawJobs = [] as Array<{
            id: string;
            title: string;
            link: string;
        }>;
        for (let i = 0; i < count; i++) {
            const ageText = await this.age.nth(i).textContent();
            const ageDays = ageText?.match(/\d+/);
            const ageValid = ageDays ? parseInt(ageDays[0], 10) < 450 : false;
            if (!ageValid) {
                console.warn('Job age exceeds threshold, skipping job extraction.');
                continue;
            }
            await this.jobCard.nth(i).click();
            await expect(this.page.locator('#spinner')).toBeHidden();
            const jobUrl =  this.page.url();
            const jobTitle = await this.title.nth(0).textContent();
            const jobId = await this.jobId.textContent();
            if (!jobId) continue;
            const title = searchTerm + ' - ' + jobTitle;
            const link = jobUrl.split('?')[0];
            const id: string | undefined = jobId?.match(/\d+/)?.[0];
            if (!id) continue;
            rawJobs.push({ id, title, link });
        }
        return this.utils.normalizeJobs(rawJobs);
    }
}