import { test, expect } from '@playwright/test';
import { JAVA_API, WEB_BASE, qrCode } from '../support/config';
import { resolveCart } from '../support/catalog';
import { viewCartBody } from '../support/payloads';

const json = { 'Content-Type': 'application/json', Accept: 'application/json' };

/** Every endpoint the qr_menu_v3 bundle can call, taken from its shared API client. */
const endpoints: [string, string][] = [
  ['POST', `/qr_online_order/${qrCode}`],
  ['GET', `/qr_online_order/${qrCode}/items/1/options`],
  ['POST', `/qr_recommended_items/${qrCode}`],
  ['GET', `/view_cart/?code=${qrCode}`],
  ['POST', `/qr_view_cart/${qrCode}`],
  ['POST', `/qr_code_order_create/${qrCode}`],
  ['GET', `/customer_orders/${qrCode}?pin=0000`],
  ['GET', `/qr_print/${qrCode}.json?view=customer`],
  ['POST', `/initiate_payment/${qrCode}`],
  ['POST', '/apple_pay/validate_merchant'],
  ['POST', `/qr_orders/add_tip/${qrCode}`],
  ['GET', `/fetch_payment_status_by_session_id/${qrCode}`],
  ['POST', `/post_order_feedback/${qrCode}`],
  ['POST', '/api/http_logs.json'],
];

test.describe('Java dine-in-service contract', () => {
  for (const [method, path] of endpoints) {
    test(`CORS preflight allows the web app: ${method} ${path.split('?')[0]}`, async ({ request }) => {
      const res = await request.fetch(`${JAVA_API}${path}`, {
        method: 'OPTIONS',
        headers: {
          Origin: WEB_BASE,
          'Access-Control-Request-Method': method,
          'Access-Control-Request-Headers': 'content-type,session-token,frontend-build-version',
        },
      });
      expect(res.status()).toBeLessThan(300);
      const headers = res.headers();
      expect(headers['access-control-allow-origin']).toBe(WEB_BASE);
      expect(headers['access-control-allow-credentials']).toBe('true');
      expect(headers['access-control-allow-methods']).toContain(method);
      for (const h of ['content-type', 'session-token', 'frontend-build-version']) {
        expect.soft(headers['access-control-allow-headers'] ?? '', `allow-headers includes ${h}`).toContain(h);
      }
    });
  }

  test('menu returns the restaurant, AED currency and categories', async ({ request }) => {
    const started = Date.now();
    const res = await request.post(`${JAVA_API}/qr_online_order/${qrCode}`, { headers: json, data: { skip_item_options: true, issue_qr_scan_token: true } });
    expect.soft(Date.now() - started, 'menu latency (ms)').toBeLessThan(3000);
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    expect(data.account.name).toBeTruthy();
    expect(data.account.currency_symbol).toBe('AED');
    expect(data.categories.length).toBeGreaterThan(0);
    for (const item of data.categories.flatMap((c: any) => c.items)) {
      expect.soft(typeof item.price, `price of ${item.name}`).toBe('number');
    }
  });

  test('cart preview prices items together with their add-ons', async ({ request }) => {
    const cart = await resolveCart(request, JAVA_API);
    const res = await request.post(`${JAVA_API}/qr_view_cart/${qrCode}`, { headers: json, data: viewCartBody(cart.lines) });
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    expect(data.order_items_total.net_payable_amount).toBeCloseTo(cart.total, 2);
    const addOnLines = data.order_items.filter((i: any) => i.linked_parent_order_item_id);
    expect(addOnLines).toHaveLength(cart.lines[1].addOns!.length);
  });

  test('recommended items are returned for the items in the cart', async ({ request }) => {
    const cart = await resolveCart(request, JAVA_API);
    const res = await request.post(`${JAVA_API}/qr_recommended_items/${qrCode}`, {
      headers: json,
      data: { table_preference_value: 2, base_item_ids: cart.lines.map((l) => String(l.itemId)) },
    });
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    expect(Array.isArray(data.add_on_items.items)).toBe(true);
  });

  test('table session state is reported', async ({ request }) => {
    const res = await request.get(`${JAVA_API}/view_cart/?code=${qrCode}`, { headers: json });
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    expect(['customer_details', 'verify_otp']).toContain(data.next_step);
  });

  test('invalid QR code is rejected with 422', async ({ request }) => {
    const res = await request.post(`${JAVA_API}/qr_online_order/INVALID123`, { headers: json, data: { skip_item_options: true } });
    expect(res.status()).toBe(422);
    expect((await res.json()).errors.base[0].message).toBe('Invalid QR Code');
  });

  test('unknown item options are rejected with 422', async ({ request }) => {
    const res = await request.get(`${JAVA_API}/qr_online_order/${qrCode}/items/999999/options`, { headers: json });
    expect(res.status()).toBe(422);
    expect((await res.json()).errors.base[0].message).toBe('Item not found');
  });
});
