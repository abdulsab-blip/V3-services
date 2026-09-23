import fs from 'node:fs';
import path from 'node:path';
import type { TestInfo } from '@playwright/test';
import { target } from './config';
import type { ApiRecorder } from './network';

/** The web app sends order lines as a header row followed by value rows. */
const decodeRows = (table: unknown): Record<string, any>[] => {
  if (!Array.isArray(table) || table.length < 2 || !Array.isArray(table[0])) return [];
  const [header, ...rows] = table as unknown[][];
  return rows.map((row) => Object.fromEntries((header as string[]).map((key, i) => [key, row[i]])));
};

const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));

export type OrderDetails = Awaited<ReturnType<typeof collectOrderDetails>>;

export async function collectOrderDetails(api: ApiRecorder, ui: { tip: number; charged: number; successAmount: number; cartTotal: number }) {
  const catalog = await api.last('POST /qr_online_order/:code');
  const menuItems = new Map<string, { name: string; price: number }>();
  for (const item of catalog.data.categories.flatMap((c: any) => c.items)) menuItems.set(String(item.id), { name: item.name, price: Number(item.price) });

  const optionNames = new Map<string, { name: string; price: number }>();
  for (const call of await api.all('GET /qr_online_order/:code/items/:id/options')) {
    for (const group of (call.responseBody as any)?.data?.options ?? []) {
      for (const o of group.customization_options ?? []) optionNames.set(String(o.id), { name: o.name, price: Number(o.price) });
    }
  }

  const create = (await api.all('POST /qr_code_order_create/:code')).at(-1)!;
  const requested = decodeRows((create.requestBody as any).order_items).map((row) => {
    const addOns = decodeRows(row.customizations).map((c) => ({
      id: c.id,
      name: optionNames.get(String(c.id))?.name ?? `option ${c.id}`,
      price: num(c.price),
      quantity: num(c.quantity),
    }));
    const unit = Number(row.price);
    const quantity = Number(row.quantity);
    return {
      item_id: String(row.item_id),
      name: menuItems.get(String(row.item_id))?.name ?? `item ${row.item_id}`,
      quantity,
      unit_price: unit,
      add_ons: addOns,
      line_total: Math.round((unit * quantity + addOns.reduce((s, a) => s + (a.price ?? 0) * (a.quantity ?? 1), 0)) * 100) / 100,
    };
  });

  const createdData = (create.responseBody as any).data;
  const created = createdData.order_items.map((i: any) => ({
    name: i.name,
    quantity: num(i.quantity),
    price_ex_vat: num(i.price),
    total_ex_vat: num(i.total_price),
    add_ons: (i.customizations ?? []).map((c: any) => c.name ?? c),
    customization_names: i.customization_names,
  }));

  const prints = await api.all('GET /qr_print/:code');
  const billCall = prints.find((c) => c.url.includes('pay_now=true')) ?? prints[0];
  const paidCall = [...prints].reverse().find((c) => c.url.includes('ct='));
  const billData = (billCall?.responseBody as any)?.data?.data;
  const paidData = (paidCall?.responseBody as any)?.data?.data;
  const bill = (billData?.order_items ?? []).map((i: any) => ({
    name: i.item_name,
    quantity: num(i.quantity),
    price_incl_vat: num(i.price),
    total_incl_vat: num(i.total_price),
    vat: num(i.tax_amount),
    add_ons: i.customization_names || (i.customizations ?? []).map((c: any) => c.name ?? c).join(', '),
  }));

  const details = {
    target,
    run_at: new Date().toISOString(),
    order_number: createdData.order_items[0]?.order_number ?? null,
    invoice_number: createdData.invoice_number ?? null,
    requested,
    requested_total: Math.round(requested.reduce((s, r) => s + r.line_total, 0) * 100) / 100,
    cart_total_ui: ui.cartTotal,
    created,
    created_total_ex_vat: num(createdData.total_amount),
    created_vat: num(createdData.taxes),
    bill,
    bill_totals: billData?.order_items_total ?? null,
    tip: ui.tip,
    charged_on_telr: ui.charged,
    success_screen_amount: ui.successAmount,
    paid_totals: paidData?.order_items_total ?? null,
    paid_tips: num(paidData?.tips),
  };

  const dir = path.join(process.cwd(), 'reports', 'runs');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${target}-order-details.json`), JSON.stringify(details, null, 2));
  return details;
}

export const attachOrderDetails = (testInfo: TestInfo, details: OrderDetails) =>
  testInfo.attach('order-details.json', { body: JSON.stringify(details, null, 2), contentType: 'application/json' });
