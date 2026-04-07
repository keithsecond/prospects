import { expect, Locator, Page } from '@playwright/test';
import { Job, Utilities } from '@classes/utilities';

export class ADP {
    page: Page;
    utils: Utilities;
    id: string;
    jobMenu: Locator;
    jobContainer: Locator;
    job: Locator;
    noResults: Locator;
    backButton: Locator;

    /**
     * Creates an ADP page model.
     * @param page Playwright page instance for browsing and actions.
     * @param id Optional site ID used to look up the URL from Utilities.URLS.
     */
    constructor(page: Page, id?: string) {
        this.page = page;
        this.utils = new Utilities();
        this.id = id || '';
        this.jobMenu = page.getByRole('link', { name: 'Current Openings' });
        this.jobContainer = page.locator('.current-openings-list-container');
        this.job = page.locator('.break-words');
        this.noResults = page.getByRole('heading', { 
            name: 'Current Openings (0 of 0)' 
        });
        this.backButton = page.getByRole('button', { name: 'Back' });
    }

    async searchPage() {
        const url = Utilities.URLS[this.id];
        await this.page.goto(url);
    }

    async search() {
        await this.jobMenu.click();
        try {
            await expect(this.jobContainer).toBeVisible();
        } catch {
            await expect(this.noResults).toBeVisible();
        }
    }

    async getJobs(): Promise<Job[]> {
        const foundJobs = this.job;
        const count = await foundJobs.count();
        const rawJobs = [] as Array<{
            id: string;
            title: string;
            link: string;
        }>;
        for (let i = 0; i < count; i++) {
            const jobWeb = foundJobs.nth(i);
            const title = await jobWeb.innerText();
            await jobWeb.click();
            await this.page.waitForURL(/&jobId=\d+/);
            const link = this.page.url();
            const id = getJobId(link);
            if (!id) continue;
            rawJobs.push({ id, title, link });
            await this.backButton.click();
            await this.page.waitForLoadState('networkidle');
        }
        return this.utils.normalizeJobs(rawJobs);
    }
}

function getJobId(url: string): string | null {
    const params = new URL(url).searchParams;
    return params.get('jobId');
}
