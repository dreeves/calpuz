/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:5003',
    viewport: { width: 900, height: 800 },
  },
  webServer: {
    command: 'python3 -m http.server 5003',
    url: 'http://127.0.0.1:5003',
    reuseExistingServer: true,
    cwd: __dirname,
  },
};

module.exports = config;
