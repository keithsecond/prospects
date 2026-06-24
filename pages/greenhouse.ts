import { Page } from '@playwright/test';
import { Job, JobDetails, Utilities } from '@classes/utilities';

export class Greenhouse {
    page: Page;
    id: string;
    url: string;
    boardToken: string;
    baseUrl: string;
    noAdmin: boolean;

    constructor(page: Page, id?: string) {
        this.page = page;
        this.id = id || '';
        this.noAdmin = false;
        this.url = Utilities.URLS[this.id];
        const match = this.url.match(/(?:job-boards(?:\.eu)?|boards)\.greenhouse\.io\/([^/?#]+)/);
        this.boardToken = match ? match[1] : '';
        this.baseUrl = 'https://boards-api.greenhouse.io';
    }

    buildUrl(): string {
        return `${this.baseUrl}/v1/boards/${this.boardToken}/jobs`;
    }

    buildDetailsUrl(jobId: string): string {
        return `${this.baseUrl}/v1/boards/${this.boardToken}/jobs/${jobId}?content=true`;
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
        const rawJobs = data.jobs
            .filter((job: any) => job.absolute_url)
            .map((job: any) => ({
                id: String(job.id),
                title: job.title,
                link: job.absolute_url,
            }));
        return Utilities.normalizeJobs(rawJobs);
    }

    async jobDetails(jobs: Job[]): Promise<JobDetails[]> {
        const rawDetails = [] as Array<{
            title: string;
            displayJobId: string;
            department: string;
            description: string;
            location: string;
            entityId: string;
        }>;

        for (const job of jobs) {
            const response = await this.page.goto(this.buildDetailsUrl(job.id));
            const data = await response?.json() as any;
            if (!data) continue;
            rawDetails.push({
                title: data.title,
                displayJobId: String(data.id),
                department: (data.departments || []).map((d: any) => d.name).filter(Boolean).join(', '),
                description: convertHtml(data.content || ''),
                location: data.location?.name || '',
                entityId: String(data.id),
            });
        }
        return rawDetails;
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
