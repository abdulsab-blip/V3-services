import fs from 'node:fs';
import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { RUBY_API, qrCode, target } from '../support/config';

const CATEGORY = 'Soups & Snacks';
const ITEM = 'Onion Samosa';
const SECOND_ITEM = 'Aloo & Cheese Samosa (Veg)';

type Expected = { linked: string[]; recommended: string[]; rubyIds: Map<number, { linked: number[]; recommended: number[] }> };

/** Ruby is the reference: its menu says which items should appear as linked / recommended. */
async function expectedFromRuby(request: APIRequestContext): Promise<Expected> {
  const load = () =>
    request.post(`${RUBY_API}/qr_online_order/${qrCode}.json`, {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      data: { skip_item_options: true },
      timeout: 60_000,
    });
  const res = await load().catch(load);
  expect(res.status()).toBe(200);
  const items = (await res.json()).data.categories.flatMap((c: any) => c.items);
  const nameOf = new Map<number, string>(items.map((i: any) => [i.id, i.name]));
  const rubyIds = new Map<number, { linked: number[]; recommended: number[] }>(
    items.map((i: any) => [i.id, { linked: i.linked_item_ids ?? [], recommended: i.recommended_item_ids ?? [] }]),
  );
  const item = items.find((i: any) => i.name === ITEM);
  const names = (ids: number[]) => ids.map((id) => nameOf.get(id)!).filter(Boolean);
  return { linked: names(item.linked_item_ids), recommended: names(item.recommended_item_ids), rubyIds };
}

const results: Record<string, unknown> = {};
const save = () => {
  const file = `reports/runs/${target}-linked-recommended.json`;
  fs.mkdirSync('reports/runs', { recursive: true });
  const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  fs.writeFileSync(file, JSON.stringify({ ...previous, ...results }, null, 2));
};

async function runChecks(page: Page, app: any, expected: Expected, label: string, snap: (n: string) => Promise<void>) {
  const outcome: Record<string, unknown> = { expected_linked: expected.linked, expected_recommended: expected.recommended };
  results[label] = outcome;

  await app.openMenu();
  await app.dismissWelcome();
  await app.openCategory(CATEGORY);

  const sheet = page.locator('section[aria-label="Complete your meal"]');
  // Ruby's build renders linked items as "Add" buttons, the v3 build as checkbox rows.
  const linkedVisible = async () => {
    const shown: string[] = [];
    for (const name of expected.linked) if (await sheet.getByText(name, { exact: true }).isVisible()) shown.push(name);
    return shown;
  };
  const openSheet = async (itemName: string) => {
    await app.menuItem(itemName).locator('[resourceid^="add-cart-click-button_"]').click();
    const shown = await sheet.waitFor({ timeout: 8_000 }).then(() => true, () => false);
    if (shown) await sheet.getByText(expected.linked[0], { exact: true }).waitFor({ timeout: 8_000 }).catch(() => undefined);
    return shown;
  };

  const sheetShown = await openSheet(ITEM);
  outcome.complete_your_meal_shown = sheetShown;
  outcome.linked_shown = sheetShown ? await linkedVisible() : [];
  await snap(`${label}-1-add-onion-samosa`);
  expect.soft(sheetShown, `"Complete your meal" bottom sheet opens with linked items for ${ITEM}`).toBe(true);
  expect.soft(outcome.linked_shown, 'linked items shown in "Complete your meal"').toEqual(expected.linked);
  if (sheetShown) {
    await page.getByRole('button', { name: 'Add item' }).click();
    await expect(sheet).toBeHidden();
  }

  const often = page.locator('section[aria-label="Often bought with"]');
  const oftenShown = await often.waitFor({ timeout: 8_000 }).then(() => true, () => false);
  outcome.often_bought_with_shown = oftenShown;
  outcome.recommended_shown = oftenShown ? await often.locator('article[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))) : [];
  await often.scrollIntoViewIfNeeded().catch(() => undefined);
  await snap(`${label}-2-often-bought-with`);
  expect.soft(oftenShown, `"Often bought with" section shown after adding ${ITEM}`).toBe(true);
  expect.soft(outcome.recommended_shown, 'recommended items shown in "Often bought with"').toEqual(expected.recommended);

  const cartLines = [ITEM, SECOND_ITEM];
  if (await openSheet(SECOND_ITEM)) {
    const linkedToAdd = expected.linked[0];
    const rubyRow = sheet.locator(`[aria-label^="${linkedToAdd}, quantity"]`);
    if (await rubyRow.count()) {
      await rubyRow.getByRole('button').last().click();
      await expect(sheet.locator(`[aria-label^="${linkedToAdd}, quantity 1"]`), `${linkedToAdd} can be added from "Complete your meal"`).toBeVisible();
    } else {
      await sheet.getByText(linkedToAdd, { exact: true }).click();
    }
    await snap(`${label}-3-linked-item-selected`);
    await page.getByRole('button', { name: 'Add item' }).click();
    await expect(sheet).toBeHidden();
    cartLines.push(linkedToAdd);
  }
  outcome.cart_items_expected = cartLines;

  const recommended = page.waitForResponse((r) => r.url().includes('/qr_recommended_items/'));
  await page.getByText(/items? added/).click();
  const bestsellerApi = (await (await recommended).json()).data.add_on_items;
  const bestsellerExpected = bestsellerApi.items.map((i: any) => i.name);
  await expect(page.getByText(bestsellerApi.title)).toBeVisible();
  const cartText = await page.locator('body').innerText();
  outcome.bestseller_title = bestsellerApi.title;
  outcome.bestseller_expected = bestsellerExpected;
  outcome.bestseller_shown = bestsellerExpected.filter((n: string) => cartText.includes(n));
  outcome.cart_items_shown = cartLines.filter((n) => cartText.includes(n));
  await snap(`${label}-4-cart-bestseller`);
  expect.soft(outcome.bestseller_shown, 'cart "Bestseller" shows the recommended items').toEqual(bestsellerExpected);
  expect.soft(outcome.cart_items_shown, 'cart contains both items and the linked item added from the sheet').toEqual(cartLines);
  save();
}

test.describe(`Linked & recommended items (${target} APIs)`, () => {
  test('Complete your meal, Often bought with and cart Bestseller for Onion Samosa', async ({ app, page, request }, testInfo) => {
    const expected = await expectedFromRuby(request);
    expect(expected.linked.length, `Ruby defines linked items for ${ITEM}`).toBeGreaterThan(0);
    const snap = async (name: string) => {
      const body = await page.screenshot({ path: `reports/screenshots/${target}/${name}.png` });
      await testInfo.attach(name, { body, contentType: 'image/png' });
    };
    await runChecks(page, app, expected, 'live', snap);
  });

  test('diagnostic: v3 UI with Ruby linked/recommended ids injected into the Java menu response', async ({ app, page, request }, testInfo) => {
    test.skip(target !== 'java', 'only meaningful for the Java UI');
    const expected = await expectedFromRuby(request);
    await page.route('**/qr_online_order/*', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      const response = await route.fetch();
      const body = await response.json();
      for (const item of body.data.categories.flatMap((c: any) => c.items)) {
        const ids = expected.rubyIds.get(item.id);
        if (ids) Object.assign(item, { linked_item_ids: ids.linked, recommended_item_ids: ids.recommended });
      }
      await route.fulfill({ response, json: body });
    });
    const snap = async (name: string) => {
      const body = await page.screenshot({ path: `reports/screenshots/${target}/${name}.png` });
      await testInfo.attach(name, { body, contentType: 'image/png' });
    };
    await runChecks(page, app, expected, 'diagnostic', snap);
  });
});
