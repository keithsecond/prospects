import { test as base } from '@playwright/test';
import { Burnett } from '@pages/sites/localRecruiters/burnett/burnettSearch';

type BurnettFixtures = {
    burnettSearch: Burnett;
    burnettQA: Burnett;
    burnettSDET: Burnett;
    burnettDesktop: Burnett;
    burnettSupport: Burnett;
    burnettAll: Burnett;
    city: string;
    jobType: string;
    skills: string;

};

export const test = base.extend<BurnettFixtures>({
    city: ['Houston, TX', { option: true }],
    jobType: ['Information Technology', { option: true }],
    skills: ['quality assurance', { option: true }],
    burnettSearch: async ({ page, city, jobType, skills }, use) => {
        const burnett = new Burnett(page, city, jobType, skills);
        await burnett.searchPage();
        await use(burnett);
    },
});

export { expect, Locator } from '@playwright/test';



