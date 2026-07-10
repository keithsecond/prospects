import { Locator, Page } from '@playwright/test';
import { Job, JobDetails, Utilities } from '@classes/utilities';
import JSZip from 'jszip';

export class Applitrack {
    page: Page;
    id: string;
    noResults: Locator;
    job: Locator;
    title: Locator;
    jobId: Locator;
    attachment: Locator;
    noAdmin: boolean;

    /**
     * Creates an Applitrack page model.
     * @param page Playwright page instance for browsing and actions.
     * @param id Optional site ID used to look up the URL from Utilities.URLS.
     */
    constructor(page: Page, id?: string) {
        this.page = page;
        this.id = id || '';
        this.noAdmin = false;
        this.noResults = page.locator('.normal', {hasText: ' (no results)'})
        this.job = page.locator('.postingsList');
        this.title = page.locator('#wrapword');
        this.jobId = page.locator('.title2');
        this.attachment = page.locator('.AppliTrackJobPostingAttachments a[href*="BrowseFile"]');
    }


    async searchPage() {
        const url = Utilities.URLS[this.id];
        const url1 = await this.page.goto(url);
        if (await this.noResults.count() >= 1) {
            return (this.noAdmin = true);
        }
    }

    async getJobs(): Promise<Job[]> {
        const foundJobs = this.job;
        const count = await foundJobs.count();
        const rawJobs = [] as Array<{
            id: string;
            title: string;
            link: string;
        }>;
        for (let i = 0; i < count; i++) {
            const title = await this.title.nth(i).innerText();
            const jobNumber = await this.jobId.nth(i).innerText();
            const id = jobNumber.replace(/\D/g, ''); 
            const link = this.page.url() + "&AppliTrackJobId=" + id;
            if (!id) continue;
            rawJobs.push({ id, title, link });
        }
        return Utilities.normalizeJobs(rawJobs);
    }

    /**
     * Fetches job detail records for the given jobs.
     * Description text is extracted from the .docx attachment on each job posting.
     * @param {Job[]} jobs - Jobs to fetch details for
     * @returns {Promise<JobDetails[]>} Detailed job records
     */
    async jobDetails(jobs: Job[]): Promise<JobDetails[]> {
        const rawDetails = [] as Array<{
            title: string;
            displayJobId: string;
            department: string;
            description: string;
            entityId: string;
        }>;

        for (const job of jobs) {
            await this.page.goto(job.link);
            const title = (await this.title.first().innerText().catch(() => '')) || job.title;
            const jobNumber = await this.jobId.first().innerText().catch(() => '');
            const displayJobId = jobNumber.replace(/\D/g, '') || job.id;
            const description = await this.getAttachmentDescription();
            rawDetails.push({
                title,
                displayJobId,
                department: '',
                description,
                entityId: job.id,
            });
        }
        return rawDetails;
    }

    /**
     * Downloads the .docx attachment linked from the current job posting
     * and extracts its plain text content.
     * @returns {Promise<string>} Extracted description text, or empty string if unavailable
     */
    private async getAttachmentDescription(): Promise<string> {
        const count = await this.attachment.count();
        for (let i = 0; i < count; i++) {
            const link = this.attachment.nth(i);
            const fileName = await link.innerText();
            if (!/\.docx?$/i.test(fileName.trim())) continue;
            const href = await link.getAttribute('href');
            if (!href) continue;
            const url = new URL(href, this.page.url()).toString();
            const response = await this.page.request.get(url);
            if (!response.ok()) continue;
            const buffer = await response.body();
            return await extractDocxText(buffer);
        }
        return '';
    }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')?.async('text');
    if (!xml) return '';
    return xml
        .replace(/<w:tab\s*\/>/g, '\t')
        .replace(/<\/w:p>/g, '\n')
        .replace(/<w:br\s*\/>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}