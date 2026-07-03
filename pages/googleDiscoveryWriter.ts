import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { Utilities } from '@classes/utilities';
import { DiscoveredSite } from './googleDiscovery';

type DraftEntry = {
    id: string;
    org: string;
    URL: string;
    Provider: string;
};

type DraftFile = {
    Draft: DraftEntry[];
};

const DRAFT_PATH = path.join(__dirname, '../test-data/draft.sites.json');

function nextDraftId(existing: DraftEntry[]): string {
    let max = 0;
    for (const entry of existing) {
        const m = entry.id.match(/^D(\d+)$/);
        if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `D${String(max + 1).padStart(4, '0')}`;
}

/**
 * Merges newly discovered sites into test-data/draft.sites.json, skipping
 * anything already known (curated sites.json or a prior draft run).
 * Returns the entries actually added.
 */
export async function writeDraftSites(discovered: DiscoveredSite[]): Promise<DraftEntry[]> {
    let data: DraftFile;
    try {
        const raw = await readFile(DRAFT_PATH, 'utf-8');
        data = JSON.parse(raw);
    } catch {
        data = { Draft: [] };
    }
    if (!Array.isArray(data.Draft)) {
        data.Draft = [];
    }

    const knownUrls = new Set<string>([
        ...Object.values(Utilities.URLS),
        ...data.Draft.map((d) => d.URL),
    ]);

    const added: DraftEntry[] = [];
    for (const site of discovered) {
        if (knownUrls.has(site.URL)) continue;
        const entry: DraftEntry = {
            id: nextDraftId(data.Draft),
            org: site.org,
            URL: site.URL,
            Provider: site.Provider,
        };
        data.Draft.push(entry);
        knownUrls.add(site.URL);
        added.push(entry);
    }

    if (added.length > 0) {
        await writeFile(DRAFT_PATH, JSON.stringify(data, null, 2));
    }
    return added;
}
