import { Locator, Page } from '@playwright/test';
import { Job, Utilities } from '@classes/utilities';

export class SchoolSpring {
    page: Page;
    utils: Utilities;
    id: string;
    closeButton: Locator;
    moreButton: Locator;
    container: Locator;
    job: Locator;
    titleCard: Locator;
    jobIdContainer: Locator;
    jobId: Locator;
    dropdown: Locator;
    adminExpand: Locator;
    techCheckbox: Locator;
    searchButton: Locator;
    noAdmin: boolean;
    
    /**
     * Creates a SchoolSpring page model.
     * @param page Playwright page instance for browsing and actions.
     * @param id Optional site ID used to look up the URL from Utilities.URLS.
     */
    constructor(
        page: Page,
        id?: string,

    ) {
        this.page = page;
        this.utils = new Utilities();
        this.id = id || '';
        this.noAdmin = false;
        this.closeButton = page.getByRole('button', { name: 'Close'});
        this.moreButton = page.getByRole('button', { name: 'More Jobs' });
        this.container = page.locator('.job-list-panel');
        this.job = this.container.locator('#joblist-div');
        this.titleCard = page.locator('.card-title.h5');
        this.jobIdContainer = page.locator('#jobDetails-desktop');
        this.jobId = this.jobIdContainer.locator('#jobId-value');
        this.dropdown = page.locator('.nestedmultiselect-container').first();
        this.adminExpand = page.getByRole('button', {name: 'expand Administration' });
        this.techCheckbox = page.getByRole('checkbox', { name: 'Technology'})
        this.searchButton = page.getByRole('button', { name: 'Search' });
    }

    /**
     * Loads the SchoolSpring site, applies the admin and technology filters,
     * clicks Search, and then expands the "More Jobs" list until completed.
     * If admin or tech filters are unavailable, sets noAdmin flag and returns early.
     */
    async searchPage() {
        const url = Utilities.URLS[this.id];
        await this.page.goto(url);
        await this.closeButton.click();
        await this.dropdown.click();
        if (await this.adminExpand.count() === 0) {
            return this.noAdmin = true;
        };
        await this.adminExpand.click({ timeout: 5000 });
        if (await this.techCheckbox.count() === 0) {
            return this.noAdmin = true;
        };
        await this.techCheckbox.check({ timeout: 5000 });    
        await this.searchButton.click();
        await this.page.waitForTimeout(500);
        while (await this.moreButton.isVisible()) {
            await this.moreButton.click();
            await this.page.waitForTimeout(500); 
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
        const rawJobs = [] as Array<{id: string; title: string; link: string}>;
        for (let i = 0; i < count; i++) {
            await this.dropdown.click();
            const jobWeb = foundJobs.nth(i);
            await jobWeb.click();
            const title = await this.titleCard.nth(i).innerText();
            const id = await this.jobId.innerText();
            const url = this.page.url();
            const link = `${url}?jobid=${id}`;
            if (!id) continue;
            rawJobs.push({id, title, link});
        }
        return this.utils.normalizeJobs(rawJobs);
    }
}