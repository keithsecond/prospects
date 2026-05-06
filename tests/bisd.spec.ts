import { test } from '@fixtures/bisd-auth';
import { Utilities } from '@classes/utilities';
import { CDPValidator } from '@classes/cdpValidator';
import { expect } from '@playwright/test';

const utils = new Utilities();
const searchTerms = ['IT', 'IT Software', 'ITIL', 'IT Support', 'IT Infrastructure', 'Help Desk', 'Help Desk Analyst', 'Service Desk'];

test.describe('BISD', () => {
    test.describe.configure({ mode: 'serial' });
    let noCdp: boolean = false;

    test.beforeAll( "CDP", async ({}, testInfo) => {
        noCdp = await CDPValidator.isUnavailable();
        testInfo.skip(noCdp, 'No CDP connection available');
    });
    for (const searchTerm of searchTerms) {
        test(`BISD ${searchTerm}`, async ({ bisd }, testInfo) => {
            test.slow();
            await bisd.search(searchTerm);
            const jobs = await bisd.getJobs(searchTerm);
            await utils.batchAppendJobs('bisd', jobs);
        });
    }
});