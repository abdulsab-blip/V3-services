import { test, expect, type APIRequestContext } from '@playwright/test';
import { JAVA_API, RUBY_API, qrCode } from '../support/config';
import { resolveCart } from '../support/catalog';
import { viewCartBody } from '../support/payloads';

const json = { 'Content-Type': 'application/json', Accept: 'application/json' };

type Case = { name: string; method: 'GET' | 'POST'; javaPath: string; rubyPath: string; body?: (request: APIRequestContext) => Promise<unknown> };

/** Read-only calls only: nothing here creates orders or changes the table session. */
const cases: Case[] = [
  { name: 'menu', method: 'POST', javaPath: `/qr_online_order/${qrCode}`, rubyPath: `/qr_online_order/${qrCode}.json`, body: async () => ({ skip_item_options: true }) },
  {
    name: 'item options',
    method: 'GET',
    javaPath: `/qr_online_order/${qrCode}/items/:customisable/options`,
    rubyPath: `/qr_online_order/${qrCode}/items/:customisable/options`,
  },
  {
    name: 'recommended items',
    method: 'POST',
    javaPath: `/qr_recommended_items/${qrCode}`,
    rubyPath: `/qr_recommended_items/${qrCode}.json`,
    body: async (request) => ({ table_preference_value: 2, base_item_ids: (await resolveCart(request, JAVA_API)).lines.map((l) => String(l.itemId)) }),
  },
  { name: 'table session state', method: 'GET', javaPath: `/view_cart/?code=${qrCode}`, rubyPath: `/view_cart/?code=${qrCode}` },
  {
    name: 'cart preview with add-ons',
    method: 'POST',
    javaPath: `/qr_view_cart/${qrCode}`,
    rubyPath: `/qr_view_cart/${qrCode}.json`,
    body: async (request) => viewCartBody((await resolveCart(request, JAVA_API)).lines),
  },
  { name: 'invalid QR code', method: 'POST', javaPath: '/qr_online_order/INVALID123', rubyPath: '/qr_online_order/INVALID123.json', body: async () => ({ skip_item_options: true }) },
];

const flatten = (value: unknown, path = '', out: Record<string, unknown> = {}) => {
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) flatten(v, `${path}.${k}`, out);
  } else {
    out[path] = value;
  }
  return out;
};

/** qr_view_cart assigns random negative ids to unsaved lines; they differ on every call. */
const isTemporaryId = (a: unknown, b: unknown) => typeof a === 'number' && typeof b === 'number' && a < 0 && b < 0;

test.describe('Ruby vs Java response parity', () => {
  for (const c of cases) {
    test(c.name, async ({ request }, testInfo) => {
      let customisableId = '';
      if (c.javaPath.includes(':customisable')) customisableId = String((await resolveCart(request, JAVA_API)).customisable.id);
      const body = c.body ? await c.body(request) : undefined;
      const call = (base: string, path: string) =>
        request.fetch(`${base}${path.replace(':customisable', customisableId)}`, { method: c.method, headers: json, data: body });

      const [ruby, java] = await Promise.all([call(RUBY_API, c.rubyPath), call(JAVA_API, c.javaPath)]);
      expect(java.status(), 'HTTP status').toBe(ruby.status());

      const r = flatten(await ruby.json());
      const j = flatten(await java.json());
      const diffs = [...new Set([...Object.keys(r), ...Object.keys(j)])]
        .filter((k) => JSON.stringify(r[k]) !== JSON.stringify(j[k]) && !isTemporaryId(r[k], j[k]))
        .map((k) => ({ field: k, ruby: r[k] === undefined ? '<missing>' : r[k], java: j[k] === undefined ? '<missing>' : j[k] }));

      const grouped: Record<string, { count: number; example: (typeof diffs)[number] }> = {};
      for (const d of diffs) {
        const key = d.field.replace(/\.\d+(?=\.|$)/g, '.*');
        grouped[key] ??= { count: 0, example: d };
        grouped[key].count += 1;
      }
      await testInfo.attach('diff.json', { body: JSON.stringify({ grouped, diffs }, null, 2), contentType: 'application/json' });
      expect(
        Object.entries(grouped).map(([field, g]) => `${field} (${g.count}x): ruby=${JSON.stringify(g.example.ruby)} java=${JSON.stringify(g.example.java)}`),
        'fields that differ between Ruby and Java',
      ).toEqual([]);
    });
  }
});
