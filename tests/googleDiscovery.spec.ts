import { test } from '@playwright/test';
import { SpecialContextPage } from '@classes/specialContextPage';
import { PROVIDERS, discoverProvider } from '@pages/googleDiscovery';
import { writeDraftSites } from '@pages/googleDiscoveryWriter';

test.describe('Google SDET Discovery', () => {
    for (const cfg of PROVIDERS) {
        test(`${cfg.provider} SDET discovery`, async ({ browser }, testInfo) => {
            const specialContext = new SpecialContextPage(browser, null as any);
            await specialContext.cdpBrowser();
            testInfo.skip(specialContext.noCdp, 'No CDP connection available');

            const found = await discoverProvider(specialContext.page, cfg);
            const added = await writeDraftSites(found);
            console.log(`${cfg.provider}: found ${found.length}, added ${added.length} new draft entries`);

            await specialContext.page.close();
        });
    }
});
