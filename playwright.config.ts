import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

const { defaultBrowserType: _ignored, ...iPhone } = devices['iPhone 13'];
const { defaultBrowserType: _pixelIgnored, ...pixel7 } = devices['Pixel 7'];

const chromeLaunchOptions = {
  args: [
    '--disable-quic',
    // On VPN the staging hosts resolve to private addresses, which Chrome's Local Network Access
    // checks block for cross-origin XHR (biz.test -> dine-in-service). Real users are not affected.
    '--disable-features=DnsOverHttps,AsyncDns,UseDnsHttpsSvcb,EncryptedClientHello,LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults',
  ],
};

// Playwright's bundled Chromium cannot be downloaded through the corporate proxy; use installed Chrome.
const mobileChrome = {
  ...iPhone,
  channel: process.env.BROWSER_CHANNEL ?? 'chrome',
  launchOptions: chromeLaunchOptions,
};

const customerMobileChrome = {
  ...pixel7,
  channel: process.env.BROWSER_CHANNEL ?? 'chrome',
  launchOptions: chromeLaunchOptions,
};

const customerBaseURL = process.env.CUSTOMER_BASE_URL || process.env.BASE_URL;

export default defineConfig({
  testDir: './tests',
  timeout: 6 * 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    actionTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'api', testDir: './tests/api' },
    { name: 'e2e', testDir: './tests/e2e', use: mobileChrome },
    { name: 'tools', testDir: './tests/tools', use: mobileChrome },
    {
      name: 'mobile-chrome',
      testDir: './tests/customer',
      use: {
        ...customerMobileChrome,
        ...(customerBaseURL ? { baseURL: customerBaseURL } : {}),
      },
    },
  ],
});
