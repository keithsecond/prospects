import { test as base } from '@playwright/test';
import { R001 } from '@pages/localRecruiters/recruiter001/recruiter001Search';
import { Utilities } from '@classes/utilities';

/**
 * Test fixtures for R001 (Recruiter001) tests.
 * @property search - Initialized R001 page model with search already loaded.
 * @property utils - Utilities instance for job processing.
 * @property city - CLI option for search location (default: empty string).
 * @property jobType - CLI option for job function filter (default: empty string).
 * @property skills - CLI option for keyword search (default: empty string).
 */
type Fixtures = {
    search: R001;
    utils: Utilities;
    city: string;
    jobType: string;
    skills: string;
};

export const test = base.extend<Fixtures>({
    city: ['', { option: true }],
    jobType: ['', { option: true }],
    skills: ['', { option: true }],

    search: async ({ page, city, jobType, skills }, use) => {
        const r001 = new R001(page, city, jobType, skills);
        await r001.searchPage();
        await use(r001);
    },

    // eslint-disable-next-line no-empty-pattern
    utils: async ({}, use) => {
        const utilities = new Utilities();
        await use(utilities);
    },
});
