import { expect, type APIRequestContext } from '@playwright/test';
import { menu, qrCode } from './config';
import type { CartLine } from './payloads';

const json = { 'Content-Type': 'application/json', Accept: 'application/json' };

/** Resolves the configured menu items and add-ons to ids and prices from the live catalogue. */
export async function resolveCart(request: APIRequestContext, base: string) {
  const catalog = await request.post(`${base}/qr_online_order/${qrCode}`, { headers: json, data: { skip_item_options: true } });
  expect(catalog.status()).toBe(200);
  const items = (await catalog.json()).data.categories.flatMap((c: any) => c.items);
  const find = (name: string) => {
    const item = items.find((i: any) => i.name === name);
    expect(item, `menu item "${name}"`).toBeTruthy();
    return item;
  };
  const simple = find(menu.simpleItem);
  const customisable = find(menu.customisableItem);

  const options = await request.get(`${base}/qr_online_order/${qrCode}/items/${customisable.id}/options`, { headers: json });
  expect(options.status()).toBe(200);
  const choices = (await options.json()).data.options.flatMap((o: any) => o.customization_options);
  const addOns = menu.addOns.map((name) => {
    const choice = choices.find((c: any) => c.name === name);
    expect(choice, `add-on "${name}"`).toBeTruthy();
    return { id: choice.id, price: Number(choice.price), mappingId: choice.customization_mapping_id };
  });

  const lines: CartLine[] = [
    { itemId: simple.id, price: Number(simple.price) },
    { itemId: customisable.id, price: Number(customisable.price), addOns },
  ];
  const total = lines.reduce((sum, l) => sum + l.price + (l.addOns ?? []).reduce((s, a) => s + a.price, 0), 0);
  return { lines, total: Math.round(total * 100) / 100, simple, customisable };
}
