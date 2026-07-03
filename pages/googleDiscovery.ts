import { Page } from '@playwright/test';

export type ProviderConfig = {
    provider: string;
    domain: string;
    extractUrl: (href: string) => string | null;
};

export type DiscoveredSite = {
    org: string;
    URL: string;
    Provider: string;
};

const MAX_PAGES = 3;
const MIN_NEXT_DELAY_MS = 3000;
const MAX_NEXT_DELAY_MS = 7000;

// Each extractUrl mirrors the URL-parsing regex the corresponding page
// object (pages/ashby.ts, pages/greenhouse.ts, ...) already applies to
// Utilities.URLS[id], so discovered entries slot in without modification.
export const PROVIDERS: ProviderConfig[] = [
    {
        provider: 'ashby',
        domain: 'ashbyhq.com',
        extractUrl: (href) => {
            const m = href.match(/jobs\.ashbyhq\.com\/([^/?#]+)/);
            return m ? `https://jobs.ashbyhq.com/${m[1]}` : null;
        },
    },
    {
        provider: 'greenhouse',
        domain: 'greenhouse.io',
        extractUrl: (href) => {
            const m = href.match(/(?:job-boards(?:\.eu)?|boards)\.greenhouse\.io\/([^/?#]+)/);
            return m ? `https://job-boards.greenhouse.io/${m[1]}` : null;
        },
    },
    {
        provider: 'lever',
        domain: 'lever.co',
        extractUrl: (href) => {
            const m = href.match(/jobs\.lever\.co\/([^/?#]+)/);
            return m ? `https://jobs.lever.co/${m[1]}` : null;
        },
    },
    {
        provider: 'smartrecruiters',
        domain: 'smartrecruiters.com',
        extractUrl: (href) => {
            const m = href.match(/(careers|jobs)\.smartrecruiters\.com\/([^/?#]+)/);
            return m ? `https://${m[1]}.smartrecruiters.com/${m[2]}` : null;
        },
    },
    {
        provider: 'recruitee',
        domain: 'recruitee.com',
        extractUrl: (href) => {
            const m = href.match(/^https:\/\/([a-z0-9-]+\.recruitee\.com)/);
            return m ? `https://${m[1]}` : null;
        },
    },
    {
        provider: 'eightfold',
        domain: 'eightfold.ai',
        extractUrl: (href) => {
            const m = href.match(/^https:\/\/([a-z0-9-]+\.eightfold\.ai)/);
            return m ? `https://${m[1]}` : null;
        },
    },
];

function buildSearchUrl(domain: string): string {
    return `https://www.google.com/search?q=${encodeURIComponent(`site:${domain} +sdet`)}`;
}

function randomDelayMs(): number {
    return MIN_NEXT_DELAY_MS + Math.floor(Math.random() * (MAX_NEXT_DELAY_MS - MIN_NEXT_DELAY_MS + 1));
}

// Best-effort org-name heuristic for a draft entry awaiting human review:
// prefer "<title> at <Org>" text from the result heading, else title-case
// the URL slug/subdomain.
function deriveOrgName(url: string, title: string): string {
    const atMatch = title.match(/ at ([A-Z][\w&.,'’-]*(?:\s+[A-Z][\w&.,'’-]*)*)/);
    if (atMatch) return atMatch[1].trim();

    const host = url.replace(/^https?:\/\//, '');
    const parts = host.split('/');
    const slug = parts.length > 1 ? parts[parts.length - 1] : parts[0].split('.')[0];
    return slug
        .replace(/[-_]+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(' ');
}

async function scrapeResultsPage(page: Page): Promise<Array<{ href: string; title: string }>> {
    return page.locator('a:has(h3)').evaluateAll((anchors) =>
        anchors
            .map((a) => ({
                href: (a as HTMLAnchorElement).href,
                title: a.querySelector('h3')?.textContent?.trim() || '',
            }))
            .filter((r) => r.href)
    );
}

async function goToNextPage(page: Page): Promise<boolean> {
    const nextLink = page.locator('#pnnext');
    if ((await nextLink.count()) === 0) {
        return false;
    }
    await new Promise((resolve) => setTimeout(resolve, randomDelayMs()));
    await nextLink.click();
    await page.waitForLoadState('domcontentloaded');
    return true;
}

export async function discoverProvider(page: Page, cfg: ProviderConfig): Promise<DiscoveredSite[]> {
    const found = new Map<string, DiscoveredSite>();
    await page.goto(buildSearchUrl(cfg.domain));

    for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
        const results = await scrapeResultsPage(page);
        for (const r of results) {
            const url = cfg.extractUrl(r.href);
            if (!url || found.has(url)) continue;
            found.set(url, {
                org: deriveOrgName(url, r.title),
                URL: url,
                Provider: cfg.provider,
            });
        }

        if (pageNum === MAX_PAGES) break;
        const advanced = await goToNextPage(page);
        if (!advanced) break;
    }

    return [...found.values()];
}
