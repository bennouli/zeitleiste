import { defineConfig, devices } from '@playwright/test'
import { READER_STATE } from './e2e/reader'

const PORT = 3100
const PUBLISHING =
    /(publishing|content-language|post-images|post-sources)\.spec\.ts/

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        baseURL: `http://localhost:${PORT}`,
        trace: 'retain-on-failure',
    },
    projects: [
        { name: 'login', testMatch: /login\.setup\.ts/, teardown: 'logout' },
        { name: 'logout', testMatch: /login\.teardown\.ts/ },
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'], storageState: READER_STATE },
            testIgnore: PUBLISHING,
            dependencies: ['login'],
        },
        {
            name: 'publishing',
            use: { ...devices['Desktop Chrome'], storageState: READER_STATE },
            testMatch: PUBLISHING,
            dependencies: ['login', 'chromium'],
        },
    ],
    webServer: {
        // A second `next dev` in this directory is refused while one runs, so e2e uses a production build.
        command: `pnpm build && pnpm exec next start -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        env: { SERVER_URL: `http://localhost:${PORT}` },
        // Locally an already running server on the port is reused; make sure it serves the current build.
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
    },
})
