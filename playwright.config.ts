import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

/* eslint-disable @typescript-eslint/no-unused-vars */
const indeedAuthFile = path.join(__dirname, '.auth', 'indeed-user.json');
const upworkAuthFile = path.join(__dirname, '.auth', 'upwork-user.json');
/* eslint-enable @typescript-eslint/no-unused-vars */

/**
 * Playwright config with two projects:
 *
 * 1. parallel-tests: All specs except bisd.spec.ts and uaWebdriver.spec.ts
 *    - ADP, Applitrack, ATJ, SchoolSpring, Eightfold, R001
 *    - Can run in parallel (multiple workers)
 *    - No CDP requirement
 *
 * 2. cdp-tests: Only bisd.spec.ts and uaWebdriver.spec.ts
 *    - Requires Chrome DevTools Protocol on port 9222
 *    - Must run serially (1 worker) due to shared auth state
 *    - Requires BISD_EMAIL and BISD_PASSWORD
 *
 * 3. discovery: Only googleDiscovery.spec.ts
 *    - Manual/on-demand only — deliberately excluded from CI, which pins
 *      --project=parallel-tests --project=cdp-tests rather than running bare
 *    - Requires Chrome DevTools Protocol on port 9222
 *
 * Usage:
 *   npx playwright test                          # Runs ALL projects, including discovery
 *   npx playwright test --project=parallel-tests # Runs only parallel tests (fast)
 *   npx playwright test --project=cdp-tests      # Runs only CDP tests (requires Chrome on 9222)
 *   npx playwright test --project=discovery      # Runs only Google discovery (requires Chrome on 9222)
 */
export default defineConfig({
    testDir: './tests',
    globalTeardown: './globalTeardown.ts',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: 'list',
    use: {
        ignoreHTTPSErrors: true,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: { mode: 'retain-on-failure' },
        contextOptions: {
            userAgent:
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        },
    },

    projects: [
        {
            name: 'parallel-tests',
            use: { ...devices['Desktop Chrome'] },
            testMatch: '**/*.spec.ts',
            testIgnore: [
                '**/dom-tests/**',
                '**/bisd.spec.ts',
                '**/uaWebdriver.spec.ts',
                '**/googleDiscovery.spec.ts',
            ],
            workers: process.env.CI ? 4 : undefined,
        },
        {
            name: 'cdp-tests',
            use: { ...devices['Desktop Chrome'] },
            testMatch: ['**/bisd.spec.ts', '**/uaWebdriver.spec.ts'],
            // CDP tests must run serially because:
            // 1. bisd-auth.ts maintains a module-scoped cached login session
            // 2. All tests connect to a single Chrome instance on port 9222
            // 3. Multiple workers would contend on auth state and CDP connection
            workers: 1,
        },
        {
            // Manual/on-demand Google-search discovery — not part of the
            // automatic CI sweep (see workflow files: they pin
            // --project=parallel-tests --project=cdp-tests explicitly).
            // Run with: npx playwright test tests/googleDiscovery.spec.ts --project=discovery
            name: 'discovery',
            use: { ...devices['Desktop Chrome'] },
            testMatch: ['**/googleDiscovery.spec.ts'],
            // Serial: shares the same CDP browser/profile as cdp-tests.
            workers: 1,
        },
    ],
});
