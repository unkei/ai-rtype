const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 10000,
  use: { baseURL: 'http://localhost:8080' },
  webServer: {
    command: 'npx serve . -p 8080 -s',
    port: 8080,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
  ],
});
