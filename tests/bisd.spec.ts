import { test } from '@fixtures/bisd-auth';
import { Job, Utilities } from '@classes/utilities';
import { CDPValidator } from '@classes/cdpValidator';

const utils = new Utilities();
const searchTerms = ['IT', 'IT Software', 'ITIL', 'IT Support', 'IT Infrastructure', 'Help Desk', 'Help Desk Analyst', 'Service Desk'];

test.describe('BISD', () => {
    test.describe.configure({ mode: 'serial' });
    let noCdp: boolean = false;
    let bisdJobs: Job[] = [];
    let existingJobIds = new Set<string>();

    test.beforeAll( "CDP", async ({}, testInfo) => {
        noCdp = await CDPValidator.isUnavailable();
        testInfo.skip(noCdp, 'No CDP connection available');
        const persistedIds = await Utilities.getSiteJobIds('I001');
        for (const id of persistedIds) {
            existingJobIds.add(id);
        }
    });
    for (const searchTerm of searchTerms) {
        test(`BISD ${searchTerm}`, async ({ bisd }) => {
            test.slow();
            const jobs = await bisd.getJobs(searchTerm);
            const newJobs: Job[] = [];
            for (const job of jobs) {
                if (!existingJobIds.has(job.id)) {
                    existingJobIds.add(job.id);
                    newJobs.push(job);
                }
            }
            bisdJobs.push(...newJobs);
            await utils.batchAppendJobs('I001', newJobs);
        });
    }
    test('BISD Job Details', async ({ bisd }) => {
        test.slow();
        const details = await bisd.jobDetails(bisdJobs);
        await utils.writeDetails('I001', details);
    });
});