import { Locator, Page } from '@playwright/test';
import { Job, Utilities } from '@classes/utilities';

export class Applitrack {
    page: Page;
    utils: Utilities;
    id: string;
    noResults: Locator;
    job: Locator;
    title: Locator;
    jobId: Locator; 
    noAdmin: boolean;

    /**
     * Creates a SchoolSpring page model.
     * @param page Playwright page instance for browsing and actions.
     * @param id Optional site ID used to look up the URL from Utilities.URLS.
     */
    constructor(page: Page, id?: string) {
        this.page = page; 
        this.utils = new Utilities();
        this.id = id || '';
        this.noAdmin = false;
        this.noResults = page.locator('.normal', {hasText: ' (no results)'})
        this.job = page.locator('.postingsList');
        this.title = page.locator('#wrapword');
        this.jobId = page.locator('.title2');
    }


    async searchPage() {
        const url = Utilities.URLS[this.id];
        const url1 = await this.page.goto(url);
        if (await this.noResults.count() >= 1) {
            return (this.noAdmin = true);
        }
    }

    /**
     * Gathers all jobs from the currently loaded search results.
     *
     * @returns Promise<Job[]> normalized job list with id, title, and link.
     */
    async getJobs(): Promise<Job[]> {
        const foundJobs = this.job;
        const count = await foundJobs.count();
        const rawJobs = [] as Array<{
            id: string;
            title: string;
            link: string;
        }>;
        for (let i = 0; i < count; i++) {
            const title = await this.title.nth(i).innerText();
            const jobNumber = await this.jobId.nth(i).innerText();
            const id = jobNumber.replace(/\D/g, ''); 
            const link = this.page.url() + "&AppliTrackJobId=" + id;
            if (!id) continue;
            rawJobs.push({ id, title, link });
        }
        return this.utils.normalizeJobs(rawJobs); 
    }
}