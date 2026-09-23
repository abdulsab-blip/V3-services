import type { Page, Response } from '@playwright/test';
import { menuPath, qrCode } from './config';

export type ApiCall = {
  endpoint: string;
  method: string;
  url: string;
  host: string;
  status: number;
  failure?: string;
  requestBody?: unknown;
  responseBody?: unknown;
};

const PAYTM_HOST = /(^|\.)paytmcheckout\.com$/;
const ASSET_HOST = /^test-assets\.|^assets\./;

const parse = (text: string | null | undefined) => {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 500);
  }
};

/**
 * Records every XHR/fetch the dine-in web app makes to a Paytm host, so a test can prove that
 * each API call went to the expected backend. Next.js page payloads (`<route>/index.txt?_rsc=`)
 * are served by the web host and are not API calls.
 */
export class ApiRecorder {
  readonly calls: ApiCall[] = [];
  private readonly pending = new Set<Promise<void>>();

  constructor(readonly expectedOrigin: string) {}

  static endpointOf(method: string, url: string) {
    const path = new URL(url).pathname
      .replace(/\.json$/, '')
      .replace(new RegExp(`/${qrCode}(?=/|$)`), '/:code')
      .replace(/\/\d+(?=\/|$)/g, '/:id')
      .replace(/\/$/, '');
    return `${method} ${path}`;
  }

  private isApi(url: URL, resourceType: string) {
    if (!['xhr', 'fetch'].includes(resourceType)) return false;
    if (!PAYTM_HOST.test(url.hostname) || ASSET_HOST.test(url.hostname)) return false;
    return !url.pathname.startsWith(menuPath);
  }

  attach(page: Page) {
    page.on('response', async (response: Response) => {
      const request = response.request();
      const url = new URL(request.url());
      if (!this.isApi(url, request.resourceType())) return;
      const call: ApiCall = {
        endpoint: ApiRecorder.endpointOf(request.method(), request.url()),
        method: request.method(),
        url: request.url(),
        host: url.origin,
        status: response.status(),
        requestBody: parse(request.postData()),
      };
      this.calls.push(call);
      const body = response.text().then(
        (text) => void (call.responseBody = parse(text)),
        () => undefined,
      );
      this.pending.add(body);
      void body.finally(() => this.pending.delete(body));
    });
    page.on('requestfailed', (request) => {
      const url = new URL(request.url());
      if (!this.isApi(url, request.resourceType())) return;
      this.calls.push({
        endpoint: ApiRecorder.endpointOf(request.method(), request.url()),
        method: request.method(),
        url: request.url(),
        host: url.origin,
        status: 0,
        failure: request.failure()?.errorText,
      });
    });
  }

  offHost() {
    return this.calls.filter((c) => c.host !== this.expectedOrigin).map((c) => `${c.endpoint} -> ${c.url}`);
  }

  failed() {
    return this.calls.filter((c) => c.status === 0 || c.status >= 400).map((c) => `${c.status} ${c.endpoint} ${c.failure ?? ''}`.trim());
  }

  endpoints() {
    return [...new Set(this.calls.map((c) => c.endpoint))];
  }

  /** All recorded calls for an endpoint, once their response bodies have been read. */
  async all(endpoint: string) {
    await Promise.all([...this.pending]);
    return this.calls.filter((c) => c.endpoint === endpoint);
  }

  async last<T = any>(endpoint: string): Promise<T> {
    const call = (await this.all(endpoint)).at(-1);
    if (!call) throw new Error(`No recorded call for ${endpoint}. Seen: ${this.endpoints().join(', ')}`);
    return call.responseBody as T;
  }

  summary() {
    const byEndpoint = new Map<string, { endpoint: string; hosts: string[]; statuses: number[]; count: number }>();
    for (const c of this.calls) {
      const row = byEndpoint.get(c.endpoint) ?? { endpoint: c.endpoint, hosts: [], statuses: [], count: 0 };
      row.count += 1;
      if (!row.hosts.includes(c.host)) row.hosts.push(c.host);
      if (!row.statuses.includes(c.status)) row.statuses.push(c.status);
      byEndpoint.set(c.endpoint, row);
    }
    return [...byEndpoint.values()];
  }
}
