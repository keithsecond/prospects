import { test as base } from '@playwright/test';
import { Burnett } from '@pages/localRecruiters/burnett/burnettSearch';
import { Utilities } from '@utils/utilities';

type Fixtures = {
    search: Burnett;
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
        const burnett = new Burnett(page, city, jobType, skills);
        await burnett.searchPage();
        await use(burnett);
    },

    utils: async ({}, use) => {
        const utilities = new Utilities();
        await use(utilities);
    },
});

export { expect, Locator } from '@playwright/test';



