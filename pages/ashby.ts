import { Page } from '@playwright/test';
import { Job, JobDetails, Utilities } from '@classes/utilities';

export class Ashby {
    page: Page;
    id: string;
    url: string;
    boardName: string;
    baseUrl: string;
    noAdmin: boolean;

    constructor(page: Page, id?: string) {
        this.page = page;
        this.id = id || '';
        this.noAdmin = false;
        this.url = Utilities.URLS[this.id];
        const match = this.url.match(/jobs\.ashbyhq\.com\/([^/?#]+)/);
        this.boardName = match ? match[1] : '';
        this.baseUrl = 'https://api.ashbyhq.com';
    }

    buildUrl(): string {
        return `${this.baseUrl}/posting-api/job-board/${this.boardName}?includeCompensation=true`;
    }

    async searchPage() {
        const response = await this.page.goto(this.buildUrl());
        const data = await response?.json();
        if (!data?.jobs || data.jobs.length === 0) {
            this.noAdmin = true;
        }
    }

    async getJobs(): Promise<Job[]> {
        const response = await this.page.goto(this.buildUrl());
        const data = await response?.json() as any;
        if (!data?.jobs) return [];
        const rawJobs = data.jobs.map((job: any) => ({
            id: String(job.id),
            title: job.title,
            link: job.jobUrl || '',
        }));
        return Utilities.normalizeJobs(rawJobs);
    }

    // Ashby's job-board API returns full descriptionHtml per job in the same
    // payload getJobs() already fetched — re-fetching here keeps jobDetails()
    // symmetric with the other page objects without costing a per-job request.
    async jobDetails(jobs: Job[]): Promise<JobDetails[]> {
        const response = await this.page.goto(this.buildUrl());
        const data = await response?.json() as any;
        if (!data?.jobs) return [];
        const wantedIds = new Set(jobs.map(j => j.id));
        return data.jobs
            .filter((job: any) => wantedIds.has(String(job.id)))
            .map((job: any) => ({
                title: job.title,
                displayJobId: String(job.id),
                department: job.department || '',
                description: convertHtml(job.descriptionHtml || ''),
                location: job.location || '',
                entityId: String(job.id),
            }));
    }
}

function convertHtml(htmlString: string): string {
    return htmlString
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/&#13;/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&ndash;/gi, ' - ')
        .replace(/&amp;/gi, '&')
        .replace(/&nbsp;/g, ' ')
        .trim();
}
