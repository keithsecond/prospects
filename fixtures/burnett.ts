import { test as base } from '@playwright/test';
import { Burnett } from '@pages/localRecruiters/burnett/burnettSearch';
import { Utilities } from '@utils/utilities';

type BurnettFixtures = {
    burnettSearch: Burnett;
    utilities: Utilities;
    city: string;
    jobType: string;
    skills: string;

};

export const test = base.extend<BurnettFixtures>({
    city: ['', { option: true }],
    jobType: ['', { option: true }],
    skills: ['', { option: true }],

    burnettSearch: async ({ page, city, jobType, skills }, use) => {
        const burnett = new Burnett(page, city, jobType, skills);
        await burnett.searchPage();
        await use(burnett);
    },

    utilities: async ({}, use) => {
        const utilities = new Utilities();
        await use(utilities);
    },

});

export { expect, Locator } from '@playwright/test';



