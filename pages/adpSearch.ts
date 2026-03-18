import { expect, Locator, Page, BrowserContext } from '@playwright/test';
import { Job, Utilities } from '@fixtures/utilities';

export class ADP {
    page: Page;
    id: string;
    jobMenu: Locator;
    jobContainer: Locator;
    job: Locator;
    backButton: Locator;
//    jobID: Locator;



    constructor(
        page: Page,
        id?: string,

    ) {
        this.page = page;
        this.id = id || '';
        this.jobMenu = page.getByRole('link', { name: 'Current Openings'})
        this.jobContainer = page.locator('.current-openings-list-container')
        this.job = page.locator('.break-words')
        this.backButton = page.getByRole('button', {name: 'Back'})
//        this.jobID = this.job.getAttribute('id')
    }

    async searchPage() {     
       const url = Utilities.URLS[this.id];
       await this.page.goto(url)
    }

    async search() {
        await this.jobMenu.click();
        await expect(this.jobContainer).toBeVisible();
    }

    async getJobs(): Promise<Job[]> {
        const foundJobs = this.job;
        const count = await foundJobs.count();
        const results: Job[] = [];
        for (let i = 0; i < count; i++) {
            const jobWeb = foundJobs.nth(i);
            const title = await jobWeb.innerText();
            await jobWeb.click();
            await this.page.waitForURL(/&jobId=\d+/);
            const link = this.page.url();
            const id = getJobId(link);
            if (!id) continue;
            results.push({
                id,
                title,
                link,
                status: '0',
                date: new Date().toISOString().split('T')[0],
                notes: ''
            });
            await this.backButton.click();
            await this.page.waitForLoadState('networkidle');
        }
    return results;    
    }
}    

function getJobId(url: string): string | null {
    const params = new URL(url).searchParams;
    return params.get('jobId');
}