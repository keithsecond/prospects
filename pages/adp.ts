import { Page } from '@playwright/test';
import { Job, JobDetails, Utilities } from '@classes/utilities';

export class ADP {
    page: Page;
    utils: Utilities;
    id: string;
    url: string;
    baseUrl: string;
    baseHref: string;
    noAdmin: boolean;

    constructor(page: Page, id?: string) {
        this.page = page;
        this.utils = new Utilities();
        this.id = id || '';
        this.url = Utilities.URLS[this.id];
        this.baseUrl = new URL(this.url).origin;
        this.baseHref = `${this.baseUrl}/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions`
        this.noAdmin = false;
    }

    private getQueryParams(): URLSearchParams {
        const url = new URL(this.url);
        return new URLSearchParams(url.search);
    }

    buildJobsUrl(): string {
        const params = this.getQueryParams();
        return `${this.baseHref}?${params.toString()}`;
    }

    buildDetailUrl(jobId: string): string {
        const params = this.getQueryParams();
        return `${this.baseHref}/${jobId}?${params.toString()}`;
    }

    async searchPage() {
        const response = await this.page.goto(this.buildJobsUrl());
        const data = await response?.json();
        if (!data?.jobRequisitions || data.jobRequisitions.length === 0) {
            this.noAdmin = true;
        }
    }

    async getJobs(): Promise<Job[]> {
        const response = await this.page.goto(this.buildJobsUrl());
        const data = await response?.json() as any;
        const jobUrlId = data.jobRequisitions[0].customFieldGroup.stringFields[0].stringValue;
        const rawJobs = data.jobRequisitions.map((job: any) => ({
            id: String(job.itemID),
            title: job.requisitionTitle,
            link: `${this.url}&jobId=${jobUrlId}`,
        }));
        return this.utils.normalizeJobs(rawJobs);
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
            const description = convertHtml(data.requisitionDescription || data.requisitionDescription || '');
            const locations = data.requisitionLocations
                .map((loc: any) => loc.address.cityName)
                .filter(Boolean)
                .join(', ') || '';
            rawDetails.push({
                title: data.requisitionTitle,
                displayJobId: data.clientRequisitionID,
                department: '',
                description: description,
                location: locations,
                entityId: data.itemID,
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