import { Page } from '@playwright/test';
import { Job, JobDetails, Utilities } from '@classes/utilities';

export class Recruitee {
    page: Page;
    id: string;
    url: string;
    baseUrl: string;
    noAdmin: boolean;

    constructor(page: Page, id?: string) {
        this.page = page;
        this.id = id || '';
        this.noAdmin = false;
        this.url = Utilities.URLS[this.id];
        const match = this.url.match(/^https:\/\/([a-z0-9-]+\.recruitee\.com)/);
        this.baseUrl = match ? `https://${match[1]}` : '';
    }

    buildUrl(): string {
        return `${this.baseUrl}/api/offers/`;
    }

    async searchPage() {
        const response = await this.page.goto(this.buildUrl());
        const data = await response?.json();
        if (!data?.offers || data.offers.length === 0) {
            this.noAdmin = true;
        }
    }

    async getJobs(): Promise<Job[]> {
        const response = await this.page.goto(this.buildUrl());
        const data = await response?.json() as any;
        if (!data?.offers) return [];
        const rawJobs = data.offers.map((job: any) => ({
            id: String(job.id),
            title: job.title,
            link: job.careers_url || job.url || '',
        }));
        return Utilities.normalizeJobs(rawJobs);
    }

    // Recruitee's offers list ships the full description inline (same
    // payload getJobs() already fetched) — no per-job request needed.
    async jobDetails(jobs: Job[]): Promise<JobDetails[]> {
        const response = await this.page.goto(this.buildUrl());
        const data = await response?.json() as any;
        if (!data?.offers) return [];
        const wantedIds = new Set(jobs.map(j => j.id));
        return data.offers
            .filter((job: any) => wantedIds.has(String(job.id)))
            .map((job: any) => ({
                title: job.title,
                displayJobId: String(job.id),
                department: job.department || '',
                description: convertHtml(job.description || ''),
                location: job.location || [job.city, job.country].filter(Boolean).join(', '),
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
