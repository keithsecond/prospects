import { test as base } from '@playwright/test';
import { R001 } from '@pages/localRecruiters/recruiter001/recruiter001Search';
import { Utilities } from '@classes/utilities';

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

    utils: async (_, use) => {
        const utilities = new Utilities();
        await use(utilities);
    },
});


