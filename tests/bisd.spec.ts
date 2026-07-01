import { test } from '@playwright/test';
import { OracleRecruiting } from '@pages/oracle';
import { Job, Utilities } from '@classes/utilities';

const searchTerms = ['IT', 'IT Software', 'ITIL', 'IT Support', 'IT Infrastructure', 'Help Desk', 'Help Desk Analyst', 'Service Desk'];

test.describe('BISD', () => {
    test.describe.configure({ mode: 'serial' });
    const utils = new Utilities();
    let bisdJobs: Job[] = [];
    let existingJobIds = new Set<string>();

    test.beforeAll(async () => {
        const persistedIds = await Utilities.getSiteJobIds('I001');
        for (const id of persistedIds) {
            existingJobIds.add(id);
        }
    });

    for (const searchTerm of searchTerms) {
        test(`BISD ${searchTerm}`, async ({ page }) => {
            const bisd = new OracleRecruiting(page, 'I001');
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

    test('BISD Job Details', async ({ page }) => {
        const bisd = new OracleRecruiting(page, 'I001');
        const details = await bisd.jobDetails(bisdJobs);
        await utils.writeDetails('I001', details);
    });
});
