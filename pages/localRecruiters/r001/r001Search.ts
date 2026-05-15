import { expect, Locator, Page } from '@playwright/test';
import { Job, Utilities } from '@classes/utilities';

export class R001 {
    page: Page;
    utils: Utilities;
    url: string;
    city: string;
    jobType: string;
    skillbox: Locator;
    locationText: Locator;
    locationComplete: Locator;
    jobBox: Locator;
    jobOption: Locator;
    jobField: Locator;
    submitButton: Locator;
    jobs: Locator;
    resultContainer: Locator;

    constructor(
        page: Page, 
    ) {
        this.page = page;
        this.utils = new Utilities();
        this.url = Utilities.URLS.R001 + '/index.smpl?arg=jb_search';
        this.city = 'Houston, TX';
        this.jobType = 'Information Technology';
        this.skillbox = page.getByRole('textbox', { name: 'Keywords' });
        this.locationText = page.getByRole('textbox', { name: 'Location' });
        this.locationComplete = page.getByRole('option', { name: this.city });
        this.jobBox = page.getByRole('combobox', { name: 'Job Function' });
        this.jobOption = page
            .getByRole('listbox')
            .locator('.category_listbox.listbox');
        this.jobField = page.getByRole('option', { name: this.jobType });
        this.submitButton = page.getByRole('button', {
            name: ' Begin Searching',
        });
        this.jobs = page.locator('.job-post-href:not(.more-arrow)');
        this.resultContainer = page.locator('.JBSearchTemplate').first();
    }

    async searchPage() {
        await this.page.goto(this.url);
    }

    async search(city: string = this.city, skills?: string) {
        await this.skillbox.fill(skills || '');
        await this.locationText.fill(city);
        await this.locationText.press('Enter');
        await expect(this.locationComplete).toBeVisible();
        await this.locationComplete.click();
        await this.jobBox.click();
        await expect(this.jobBox).toHaveAttribute('aria-expanded', 'true');
        await expect(
            this.jobOption.locator('.category_listbox.listbox.open')
        ).toBeTruthy();
        await this.jobField.click();
        await this.submitButton.click();
        await this.page.waitForLoadState('domcontentloaded', { timeout: 60000 });
    }

    async getJobs(): Promise<Job[]> {
        await this.resultContainer.all();
        const foundJobs = this.jobs;
        const count = await foundJobs.count();
        const rawJobs = [] as Array<{
            id: string;
            title: string;
            link: string;
        }>;
        for (let i = 0; i < count; i++) {
            const jobWeb = foundJobs.nth(i);
            const title = await jobWeb.textContent();
            const href = await jobWeb.getAttribute('href');
            const link = Utilities.URLS.R001 + href;
            if (!link || link === '#') continue;
            const id = link.split('/').pop() || '';
            if (!id || !title) continue;
            rawJobs.push({ id, title, link });
        }
        return this.utils.normalizeJobs(rawJobs);
    }
}
