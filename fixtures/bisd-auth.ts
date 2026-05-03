import { test as base } from '@playwright/test';
import { BISD } from '@pages/bisd';
import { SpecialContextPage } from '@classes/specialContextPage';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.auth/.env') });

let cachedBISD: BISD | null = null;
let cachedSpecialContext: SpecialContextPage | null = null;
let isLoginComplete = false;

/**
 * Test fixtures for BISD tests with authentication.
 * Caches authenticated BISD instance to reuse across tests.
 */
type BISDFixtures = {
    bisd: BISD;
};

export const test = base.extend<BISDFixtures>({
    bisd: async ({ browser }, use) => {
        try {
            if (cachedBISD && isLoginComplete) {
                console.log('Reusing cached authenticated BISD session');
                await use(cachedBISD);
                return;
            }

            // New session if no cached instance or login not complete
            cachedSpecialContext = new SpecialContextPage(browser, null as any);
            await cachedSpecialContext.cdpBrowser();
            cachedBISD = new BISD(cachedSpecialContext.page);
            await cachedBISD.searchPage();

            const email = process.env.BISD_EMAIL;
            const password = process.env.BISD_PASSWORD;
            if (email && password) {
                console.log('Attempting login...');
                await cachedBISD.login(email, password);
                console.log('BISD login successful');
                isLoginComplete = true;
            } else {
                console.warn('BISD_EMAIL and BISD_PASSWORD not set in .auth/.env - skipping login');
            }
            await use(cachedBISD);
        } catch (error) {
            console.error('BISD fixture setup failed:', error);
            throw error;
        }
    },
});