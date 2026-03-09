import { test as base } from '@playwright/test';
import { Burnett } from '@pages/localRecruiters/burnett/burnettSearch';

type BurnettFixtures = {
    burnettSearch: Burnett;
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
});

export { expect, Locator } from '@playwright/test';



