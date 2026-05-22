import { Page } from '@playwright/test';
import { Job, JobDetails, Utilities } from '@classes/utilities';

export class SchoolSpring {
    page: Page;
    utils: Utilities;
    id: string;
    url: string;
    baseUrl: string;
    boardToken: string;
    noAdmin: boolean;

    constructor(page: Page, id?: string) {
        this.page = page;
        this.utils = new Utilities();
        this.id = id || '';
        this.noAdmin = false;
        this.url = Utilities.URLS[this.id];
        const match = this.url.match(/https:\/\/(.+?)\.schoolspring\.com/);
        this.boardToken = match ? match[1] : '';
        this.baseUrl = 'https://api.schoolspring.com';
    }

    buildUrl(page = 1, size = 250): string {
        const q = new URLSearchParams();
        q.set('domainName', `${this.boardToken}.schoolspring.com`);
        q.set('category', '17,171,172,224');
        q.set('jobtype', '1');
        q.set('page', String(page));
        q.set('size', String(size));
        q.set('sortDateAscending', 'false');
        return `${this.baseUrl}/api/Jobs/GetPagedJobsWithSearch?${q.toString()}`;
    }

    buildDetailsUrl(jobId: string): string {
        const q = new URLSearchParams();
        q.set('domainName', `${this.boardToken}.schoolspring.com`);
        return `${this.baseUrl}/api/Jobs/${jobId}?${q.toString()}`;
    }

    async searchPage() {
        const url = this.buildUrl();
        const response = await this.page.goto(url);
        const data = await response?.json();
        if (!data?.success || !data.value?.jobsList) {
            this.noAdmin = true;
            return;
        }
        if (data.value.jobsList.length === 0) {
            this.noAdmin = true;
        }
    }

    async getJobs(): Promise<Job[]> {
        const url = this.buildUrl();
        const response = await this.page.goto(url);
        const data = await response?.json() as any;
        if (!data?.success || !data.value?.jobsList) {
            return [];
        }
        const rawJobs = data.value.jobsList.map((job: any) => ({
            id: String(job.jobId),
            title: job.title,
            link: `${this.url}/?jobid=${job.jobId}`,
        }));
        return this.utils.normalizeJobs(rawJobs);
    }

    async jobDetails(jobs: Job[]): Promise<JobDetails[]> {
        const rawDetails = [] as Array<{
            title: string;
            displayJobId: string;
            department: string;
            description: string;
            entityId: string;
        }>;

        for (const job of jobs) {
            const url = this.buildDetailsUrl(job.id);
            const response = await this.page.goto(url);
            const data = await response?.json() as any;
            if (!data?.success || !data.value?.jobInfo) {
                continue;
            }
            const jobInfo = data.value.jobInfo;
            rawDetails.push({
                title: jobInfo.jobTitle,
                displayJobId: jobInfo.externalJobCode,
                department: `${jobInfo.contactTitle} ${jobInfo.contactAddress1} ${jobInfo.contactEmail} ${jobInfo.contactPhone}`,
                description: convertHtml(jobInfo.jobDescription || ''),
                entityId: jobInfo.jobId,
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
        .replace(/&nbsp;/g, '')
        .trim();
}