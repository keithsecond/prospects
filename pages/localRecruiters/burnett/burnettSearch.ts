import { expect, Locator, Page } from '@playwright/test';

export class Burnett {
    page: Page;
    skills: string;
    location: string;
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
        location?: string,
        jobType?: string,
        skills?: string,
    ) {
        this.page = page;
        this.location = location || '';
        this.jobType = jobType || '';
        this.skills = skills || '';
        this.skillbox = page.getByRole('textbox', { name: 'Keywords' });
        this.locationText = page.getByRole('textbox', { name: 'Location' });
        this.locationComplete = page.getByRole('option', { name: location });
        this.jobBox = page.getByRole('combobox', { name: 'Job Function' });
        this.jobOption = page.getByRole('listbox').locator('.category_listbox.listbox');
        this.jobField = page.getByRole('option', { name: jobType });
        this.submitButton = page.getByRole('button', { name: ' Begin Searching' });
        this.jobs = page.locator('.job-post-href:not(.more-arrow)');
        this.resultContainer = page.locator('.JBSearchTemplate').first();
    }

    async searchPage() {
        await this.page.goto('https://jobs.burnettspecialists.com/index.smpl?arg=jb_search');
    }

    async search() {
        await this.skillbox.fill(this.skills);
        await this.locationText.fill(this.location);
        await expect(this.locationComplete).toBeVisible();
        await this.locationComplete.click();
        await this.jobBox.click();
        await expect(this.jobBox).toHaveAttribute('aria-expanded', 'true');
        await expect(this.jobOption.locator('.category_listbox.listbox.open')).toBeTruthy();
        await this.jobField.click();
        await this.submitButton.click();
    }
}