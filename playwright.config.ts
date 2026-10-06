import { defineConfig, devices } from '@playwright/test';

// The suite starts its own API + web on separate ports with an in-memory database, so every run
// starts from only the seeded units and ruleset, runs alongside `npm run dev` and never touches
// var/app.db. An empty key forces the stub model.
const WEB_PORT = 3010;
const API_PORT = 8093;

export default defineConfig({
  testDir: './e2e',
  // The flows share one database, so they run one after another
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Every test is recorded, so the HTML report (npx playwright show-report) shows what was clicked
    video: 'on',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node -e "require(\'node:fs\').rmSync(\'var/e2e\',{recursive:true,force:true})" && npm run dev',
    // Through the web proxy, so both servers are up and the API has finished seeding
    url: `http://localhost:${WEB_PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      API_PORT: String(API_PORT),
      WEB_PORT: String(WEB_PORT),
      DATABASE_URL: 'file::memory:',
      UPLOAD_DIR: './var/e2e/uploads',
      OPENROUTER_API_KEY: '',
    },
  },
});
