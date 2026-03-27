import { Locator, Page } from '@playwright/test';
import { Job, Utilities } from '@classes/utilities';

export class ATJ {
    page: Page;
    utils: Utilities;
    id: string;
    container: Locator;
    job: Locator;

    constructor(
        page: Page,
        id?: string,

    ) {
        this.page = page;
        this.utils = new Utilities();
        this.id = id || '';
        this.container = this.page.locator('.list-group-item-heading');
        this.job = this.container.getByRole('link');
    }

    async searchPage() {
        const url = Utilities.URLS[this.id];
        await this.page.goto(url);
    }

    async getJobs(): Promise<Job[]> {
        const foundJobs = this.job;
        const count = await foundJobs.count();
        console.log(count, 'count');
        const rawJobs = [] as Array<{id: string; title: string; link: string}>;
        for (let i = 0; i < count; i++) {
            const jobWeb = foundJobs.nth(i);
            const title = await jobWeb.innerText();
            const link = await jobWeb.getAttribute('href');
            if (!link) continue;
            const id = (link.match(/apply\/([^/]+)/)?.[1]) || '';
            if (!id) continue;
            rawJobs.push({id, title, link});
        }
        return this.utils.normalizeJobs(rawJobs);
    }

}



