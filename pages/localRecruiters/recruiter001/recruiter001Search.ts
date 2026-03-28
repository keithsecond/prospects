import { expect, Locator, Page } from '@playwright/test';
import { Job, Utilities } from '@classes/utilities';

export class R001 {
    page: Page;
    utils: Utilities;
    skills: string;
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

    /**
     * Creates an R001 page model.
     * @param page Playwright page instance for browsing and actions.
     * @param location Optional city/location to search for jobs.
     * @param jobType Optional job function/type filter (e.g., "Technology").
     * @param skills Optional keywords to search for in job listings.
     */
    constructor(
        page: Page, 
        location?: string,
        jobType?: string,
        skills?: string
    ) {
        this.page = page;
        this.utils = new Utilities();
        this.city = location || '';
        this.jobType = jobType || '';
        this.skills = skills || '';
        this.skillbox = page.getByRole('textbox', { name: 'Keywords' });
        this.locationText = page.getByRole('textbox', { name: 'Location' });
        this.locationComplete = page.getByRole('option', { name: location });
        this.jobBox = page.getByRole('combobox', { name: 'Job Function' });
        this.jobOption = page
            .getByRole('listbox')
            .locator('.category_listbox.listbox');
        this.jobField = page.getByRole('option', { name: jobType });
        this.submitButton = page.getByRole('button', {
            name: ' Begin Searching',
        });
        this.jobs = page.locator('.job-post-href:not(.more-arrow)');
        this.resultContainer = page.locator('.JBSearchTemplate').first();
    }

    async searchPage() {
        await this.page.goto(Utilities.URLS.R001);
    }

    async search() {
        await this.skillbox.fill(this.skills);
        await this.locationText.fill(this.city);
        await expect(this.locationComplete).toBeVisible();
        await this.locationComplete.click();
        await this.jobBox.click();
        await expect(this.jobBox).toHaveAttribute('aria-expanded', 'true');
        await expect(
            this.jobOption.locator('.category_listbox.listbox.open')
        ).toBeTruthy();
        await this.jobField.click();
        await this.submitButton.click();
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
            const link = await jobWeb.getAttribute('href');
            if (!link || link === '#') continue;
            const id = link.split('/').pop() || '';
            if (!id || !title) continue;
            rawJobs.push({ id, title, link });
        }
        return this.utils.normalizeJobs(rawJobs);
    }
}
