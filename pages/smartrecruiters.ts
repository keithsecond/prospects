import { Page } from '@playwright/test';
import { Job, JobDetails, Utilities } from '@classes/utilities';

export class SmartRecruiters {
    page: Page;
    id: string;
    url: string;
    slug: string;
    baseUrl: string;
    noAdmin: boolean;
    pageSize: number;

    constructor(page: Page, id?: string) {
        this.page = page;
        this.id = id || '';
        this.noAdmin = false;
        this.url = Utilities.URLS[this.id];
        const match = this.url.match(/(?:careers|jobs)\.smartrecruiters\.com\/([^/?#]+)/);
        this.slug = match ? match[1] : '';
        this.baseUrl = 'https://api.smartrecruiters.com';
        this.pageSize = 100;
    }

    buildUrl(offset = 0): string {
        return `${this.baseUrl}/v1/companies/${this.slug}/postings?limit=${this.pageSize}&offset=${offset}&status=PUBLIC`;
    }

    buildDetailUrl(jobId: string): string {
        return `${this.baseUrl}/v1/companies/${this.slug}/postings/${jobId}`;
    }

    async searchPage() {
        const response = await this.page.goto(this.buildUrl());
        const data = await response?.json();
        if (!data?.content || data.content.length === 0) {
            this.noAdmin = true;
        }
    }

    async getJobs(): Promise<Job[]> {
        const rawJobs: Array<{ id: string; title: string; link: string }> = [];
        let offset = 0;
        for (let page = 0; page < 50; page++) {
            const response = await this.page.goto(this.buildUrl(offset));
            const data = await response?.json() as any;
            const content = data?.content || [];
            if (content.length === 0) break;
            for (const job of content) {
                rawJobs.push({
                    id: String(job.id),
                    title: job.name,
                    link: `https://jobs.smartrecruiters.com/${this.slug}/${job.id}`,
                });
            }
            if (content.length < this.pageSize) break;
            offset += this.pageSize;
        }
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
            const response = await this.page.goto(this.buildDetailUrl(job.id));
            const data = await response?.json() as any;
            if (!data) continue;
            const sections = data.jobAd?.sections || {};
            const description = [
                sections.jobDescription?.text,
                sections.qualifications?.text,
                sections.additionalInformation?.text,
            ].filter(Boolean).map(convertHtml).join('\n\n');
            const loc = data.location || {};
            const location = loc.fullLocation || [loc.city, loc.region, loc.country].filter(Boolean).join(', ');
            rawDetails.push({
                title: data.name,
                displayJobId: String(data.id),
                department: data.department?.label || '',
                description,
                location,
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
