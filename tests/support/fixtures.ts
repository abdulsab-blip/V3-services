import { test as base, expect } from '@playwright/test';
import { apiBase } from './config';
import { ApiRecorder } from './network';
import { DineInApp } from './app';

type Fixtures = {
  api: ApiRecorder;
  app: DineInApp;
};

export const test = base.extend<Fixtures>({
  api: async ({ page }, use, testInfo) => {
    const recorder = new ApiRecorder(apiBase);
    recorder.attach(page);
    await use(recorder);

    const summary = recorder.summary();
    await testInfo.attach('api-calls.json', { body: JSON.stringify(summary, null, 2), contentType: 'application/json' });
    console.log(`\nAPI calls (expected host ${apiBase}):`);
    console.table(summary.map((r) => ({ endpoint: r.endpoint, calls: r.count, status: r.statuses.join('/'), host: r.hosts.join(', ') })));

    expect.soft(recorder.offHost(), `every API call must go to ${apiBase}`).toEqual([]);
    expect.soft(recorder.failed(), 'no API call may fail').toEqual([]);
  },
  app: async ({ page, api }, use) => {
    await use(new DineInApp(page, api));
  },
});

export { expect };
