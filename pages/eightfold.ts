import { Page } from '@playwright/test';
import { Job, JobDetails, Utilities } from '@classes/utilities';

export class Eightfold {
    page: Page;
    utils: Utilities;
    domain: string;
    baseUrl: string;

    constructor(page: Page, subdomain: string, domain: string) {
        this.page = page;
        this.utils = new Utilities();
        this.domain = domain;
        this.baseUrl = `https://${subdomain}.eightfold.ai`;
    }

    buildUrl(params: Record<string, string | string[]>, start = 0): string {
        const q = new URLSearchParams();
        q.set('domain', this.domain);
        q.set('query', '');
        q.set('location', '');
        q.set('start', String(start));
        q.set('sort_by', 'timestamp');
        for (const [k, v] of Object.entries(params)) {
            if (k === 'query' || k === 'location') {
                q.set(k, Array.isArray(v) ? v[0] : v);
            } else if (Array.isArray(v)) {
                v.forEach(val => q.append(k, val));
            } else {
                q.set(k, v);
            }
        }
        return `${this.baseUrl}/api/pcsx/search?${q.toString()}`;
    }

    async getJobs(params: Record<string, string | string[]> = {}): Promise<Job[]> {
        const rawJobs: Array<{
            id: string;
            title: string;
            link: string
        }> = [];
        const pageSize = 10;
        let start = 0;
        let totalCount = Infinity;

        while (start < totalCount) {
            const url = this.buildUrl(params, start);
            const response = await this.page.goto(url);
            const json = await response?.json();

            if (start === 0) {
                totalCount = json.data.count;
                console.log(`Eightfold ${this.domain}: ${totalCount} total positions`);
                if (totalCount === 0) break;
            }

            const positions = json.data.positions;
            if (!positions.length) break;

            for (const pos of positions) {
                rawJobs.push({
                    id: String(pos.displayJobId),
                    title: pos.name,
                    link: `${this.baseUrl}/careers?pid=${pos.id}`,
                });
            }

            start += pageSize;
        }
        return this.utils.normalizeJobs(rawJobs);
    }

    buildDetailsUrl(positionId: string): string {
        const q = new URLSearchParams();
        q.set('position_id', positionId);
        q.set('domain', this.domain);
        q.set('hl', 'en');
        return `${this.baseUrl}/api/pcsx/position_details?${q.toString()}`;
    }

    async jobDetails(siteIdOrJobs: string | string[] | Job[]): Promise<JobDetails[]> {
        const rawDetails: Array<{
            title: string;
            displayJobId: string;
            department: string;
            location: string;
            worksite: string;
            description: string;
            entityId: string;
        }> = [];

        const ids = Array.isArray(siteIdOrJobs)
            ? Array.from(new Set(
                (siteIdOrJobs as Array<string | Job>).map(item =>
                    typeof item === 'string' ? item : item.id
                )
            ))
            : await Utilities.getSiteJobIds(siteIdOrJobs) as string[];

        const count = ids.length;
        console.log(`Eightfold ${this.domain}: fetching details for ${count} positions`);

        for (let i = 0; i < count; i++) {
            const url = this.buildDetailsUrl(ids[i]);
            const response = await this.page.goto(url);
            const json = await response?.json();

            if (!json.data.position) {
                console.error(`No position data returned for id: ${ids[i]}`);
                continue;
            }

            const pos = json.data.position;
            rawDetails.push({
                title: pos.name,
                displayJobId: String(pos.displayJobId),
                department: pos.department,
                location: pos.locations,
                worksite: pos.workLocationOption,
                description: convertHtml(pos.jobDescription),
                entityId: String(pos.id),
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
