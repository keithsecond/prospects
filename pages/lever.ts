import { Page } from '@playwright/test';
import { Job, JobDetails, Utilities } from '@classes/utilities';

export class Lever {
    page: Page;
    id: string;
    url: string;
    company: string;
    baseUrl: string;
    noAdmin: boolean;

    constructor(page: Page, id?: string) {
        this.page = page;
        this.id = id || '';
        this.noAdmin = false;
        this.url = Utilities.URLS[this.id];
        const match = this.url.match(/jobs\.lever\.co\/([^/?#]+)/);
        this.company = match ? match[1] : '';
        this.baseUrl = 'https://api.lever.co';
    }

    buildUrl(): string {
        return `${this.baseUrl}/v0/postings/${this.company}?mode=json`;
    }

    async searchPage() {
        const response = await this.page.goto(this.buildUrl());
        const data = await response?.json();
        if (!Array.isArray(data) || data.length === 0) {
            this.noAdmin = true;
        }
    }

    async getJobs(): Promise<Job[]> {
        const response = await this.page.goto(this.buildUrl());
        const data = await response?.json() as any;
        if (!Array.isArray(data)) return [];
        const rawJobs = data.map((job: any) => ({
            id: String(job.id),
            title: job.text,
            link: job.hostedUrl || '',
        }));
        return Utilities.normalizeJobs(rawJobs);
    }

    // Lever's postings list ships the full description for free (same
    // payload getJobs() already fetched) — no per-job request needed.
    async jobDetails(jobs: Job[]): Promise<JobDetails[]> {
        const response = await this.page.goto(this.buildUrl());
        const data = await response?.json() as any;
        if (!Array.isArray(data)) return [];
        const wantedIds = new Set(jobs.map(j => j.id));
        
        return data
            .filter((job: any) => wantedIds.has(String(job.id)))
            .map((job: any) => ({
                title: job.text,
                displayJobId: String(job.id),
                department: job.categories?.team || '',
                description: convertHtml(job.descriptionBody + " " + job.descriptionBodyPlain + " " + job.lists.flatMap((item: any) => Object.values(item)).join(', ')),
                location: job.categories?.location || '',
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