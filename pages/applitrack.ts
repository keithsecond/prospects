import { Locator, Page } from '@playwright/test';
import { Job, JobDetails, Utilities } from '@classes/utilities';
import WordExtractor from 'word-extractor';
import pdfParse from 'pdf-parse';

const extractor = new WordExtractor();

export class Applitrack {
    page: Page;
    id: string;
    noResults: Locator;
    job: Locator;
    title: Locator;
    jobId: Locator;
    attachment: Locator;
    description: Locator;
    department: Locator;
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
        this.description = page.locator('.postingsList span.normal').filter({ has: page.locator('p') });
        this.department = page.locator('li').filter({ has: page.locator('span.label', { hasText: 'Location:' }) }).locator('span.normal');
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
     * Description text is extracted from the Word or PDF attachment on each job posting.
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
            const description = await this.getAttachmentDescription();
            const department = await this.department.first().innerText().catch(() => '');
            rawDetails.push({
                title: job.title,
                displayJobId: job.id,
                department,
                description,
                entityId: job.id,
            });
        }
        return rawDetails;
    }

    /**
     * Resolves the job description, preferring the Word attachment linked from the
     * current job posting. Falls back to the description embedded in the page itself
     * when no attachment is present.
     * @returns {Promise<string>} Extracted description text, or empty string if unavailable
     */
    private async getAttachmentDescription(): Promise<string> {
        const attachmentText = await this.getAttachmentText();
        if (attachmentText) return attachmentText;
        return (await this.description.first().innerText().catch(() => '')).trim();
    }

    /**
     * Downloads the document attachment linked from the current job posting
     * and extracts its plain text content. AppliTrack doesn't always serve the
     * file format the attachment's displayed name implies, so the file's own
     * magic bytes (not its extension) decide which parser to use.
     * @returns {Promise<string>} Extracted description text, or empty string if unavailable
     */
    private async getAttachmentText(): Promise<string> {
        const link = this.attachment.first();
        if (await link.count() === 0) return '';
        const fileName = await link.innerText();
        if (!/\.(docx?|pdf)$/i.test(fileName.trim())) return '';
        const href = await link.getAttribute('href');
        if (!href) return '';
        const url = new URL(href, this.page.url()).toString();
        const response = await this.page.request.get(url);
        if (!response.ok()) return '';
        const buffer = await response.body();
        try {
            if (buffer.subarray(0, 4).toString('latin1') === '%PDF') {
                const data = await pdfParse(buffer);
                return data.text.trim();
            }
            const doc = await extractor.extract(buffer);
            return doc.getBody().trim();
        } catch (err) {
            console.error(`Failed to extract text from attachment: ${err}`);
            return '';
        }
    }
}
