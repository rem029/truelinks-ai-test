import { defineConfig, devices } from '@playwright/test';

// The suite starts its own API + web on separate ports with a throwaway database, so it runs
// alongside `npm run dev` and never touches var/app.db. An empty key forces the stub model.
const WEB_PORT = 3010;
const API_PORT = 8093;

export default defineConfig({
  testDir: './e2e',
  // The flows share one database, so they run one after another
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node -e "require(\'node:fs\').rmSync(\'var/e2e\',{recursive:true,force:true})" && npm run dev',
    url: `http://localhost:${WEB_PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      API_PORT: String(API_PORT),
      WEB_PORT: String(WEB_PORT),
      DATABASE_URL: 'file:./var/e2e/app.db',
      UPLOAD_DIR: './var/e2e/uploads',
      OPENROUTER_API_KEY: '',
    },
  },
});
