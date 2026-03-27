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
    
    constructor(
        page: Page,
        id?: string,

    ) {
        this.page = page;
        this.utils = new Utilities();
        this.id = id || '';
        this.closeButton = page.getByRole('button', { name: 'Close'});
        this.moreButton = page.getByRole('button', { name: 'More Jobs' });
        this.container = page.locator('.job-list-panel');
        this.job = this.container.locator('#joblist-div');
        this.titleCard = page.locator('.card-title.h5');
        this.jobIdContainer = page.locator('#jobDetails-desktop');
        this.jobId = this.jobIdContainer.locator('#jobId-value');
    }

    async searchPage() {
        const url = Utilities.URLS[this.id];
        await this.page.goto(url);
        await this.closeButton.click();
        while (await this.moreButton.isVisible()) {
            await this.moreButton.click();
            await this.page.waitForTimeout(500); 
        }
    }

    async getJobs(): Promise<Job[]> {
        const foundJobs = this.job;
        const count = await foundJobs.count();
        const rawJobs = [] as Array<{id: string; title: string; link: string}>;
        for (let i = 0; i < count; i++) {
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