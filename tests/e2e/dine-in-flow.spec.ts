import { devices, type APIRequestContext } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { ApiRecorder } from '../support/network';
import { DineInApp } from '../support/app';
import { attachOrderDetails, collectOrderDetails } from '../support/order-details';
import { aed, apiBase, customer, flowEndpoints, menu, qrCode, round2, tablePin, target, withGuest } from '../support/config';

const { defaultBrowserType: _ignored, ...iPhone } = devices['iPhone 13'];

const tableState = async (request: APIRequestContext) => {
  const res = await request.get(`${apiBase}/view_cart/?code=${qrCode}`, { headers: { Accept: 'application/json' } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data as { next_step: string; pin_generated: boolean };
};

const amountAfter = (text: string, label: RegExp) => {
  const match = text.replace(/\s+/g, ' ').match(new RegExp(`${label.source}\\s*AED\\s*([\\d.]+)`));
  return match ? Number(match[1]) : NaN;
};

test.describe(`Dine-in QR flow (${target} APIs)`, () => {
  test('order a simple and a customised item, pay by card, leave feedback', async ({ app, api, page, request, browser }, testInfo) => {
    const snap = async (name: string) => {
      const body = await page.screenshot({ path: `reports/screenshots/${target}/${name}.png` });
      await testInfo.attach(name, { body, contentType: 'image/png' });
    };
    const bodyText = () => page.locator('body').innerText();

    await test.step('precondition: the table has no open session', async () => {
      const state = await tableState(request);
      if (state.next_step !== 'customer_details') {
        // A previous run stopped before paying. Settle it with the same customer so the table is free.
        await app.openMenu();
        await app.joinTableWithPin(tablePin);
        await app.generateBill();
        const telr = await app.chooseCardPayment();
        const settleCharged = await telr.locator('#cardpaybutton_v2').innerText();
        const settleBill = (await api.last('GET /qr_print/:code')).data.data;
        await testInfo.attach('settled-open-order.json', {
          contentType: 'application/json',
          body: JSON.stringify({
            charged: settleCharged,
            totals: settleBill.order_items_total,
            items: settleBill.order_items.map((i: any) => ({ name: i.item_name, price: i.price, add_ons: i.customization_names })),
          }, null, 2),
        });
        await app.payWithCard();
      }
      expect((await tableState(request)).next_step, 'table should be free before the run').toBe('customer_details');
      api.calls.length = 0;
    });

    await test.step('landing: welcome sheet and menu load', async () => {
      await app.openMenu();
      await expect(page.getByText(/You are on table/)).toBeVisible();
      await snap('01-welcome');
      await app.dismissWelcome();
      const catalog = (await api.last('POST /qr_online_order/:code')).data;
      expect(catalog.account.currency_symbol).toBe('AED');
      expect(catalog.categories.length).toBeGreaterThan(0);
      await expect(page.getByPlaceholder('Search menu...')).toBeVisible();
    });

    const priceOf = async (name: string) => {
      const items = (await api.last('POST /qr_online_order/:code')).data.categories.flatMap((c: any) => c.items);
      const item = items.find((i: any) => i.name === name);
      expect(item, `menu item "${name}"`).toBeTruthy();
      return Number(item.price);
    };

    let expectedCart = 0;
    await test.step('menu: add a simple item', async () => {
      await app.openCategory(menu.category);
      await app.addSimpleItem(menu.simpleItem);
      await expect(page.getByText('1 items added')).toBeVisible();
      expectedCart += await priceOf(menu.simpleItem);
      await snap('02-simple-item-added');
    });

    await test.step('item sheet: add a customisable item with add-ons', async () => {
      await app.addCustomisedItem(menu.customisableItem, menu.addOns);
      const options = (await api.last('GET /qr_online_order/:code/items/:id/options')).data.options.flatMap((o: any) => o.customization_options);
      const addOnTotal = menu.addOns.reduce((sum, name) => {
        const option = options.find((o: any) => o.name === name);
        expect(option, `add-on "${name}"`).toBeTruthy();
        return sum + Number(option.price);
      }, 0);
      expectedCart = round2(expectedCart + (await priceOf(menu.customisableItem)) + addOnTotal);
      await expect(page.getByText('2 items added')).toBeVisible();
      await snap('03-customised-item-added');
    });

    await test.step('cart: items, add-ons and total are correct', async () => {
      await app.openCart();
      await expect(page.getByText(menu.simpleItem, { exact: true })).toBeVisible();
      await expect(page.getByText(menu.customisableItem, { exact: true })).toBeVisible();
      await expect(page.getByText(menu.addOns.join(', '))).toBeVisible();
      await expect(page.getByText(aed(expectedCart)).first()).toBeVisible();
      expect((await api.last('POST /qr_recommended_items/:code')).data).toBeTruthy();
      await snap('04-cart');
    });

    await test.step('place order: customer details and swipe to send to kitchen', async () => {
      await app.sendToKitchen();
      const order = (await api.last('POST /qr_code_order_create/:code')).data;
      expect(order.next_step).toBe('order_summary');
      expect(order.session_pin).toBe(tablePin);
      const customised = order.order_items.find((i: any) => i.name === menu.customisableItem);
      expect.soft(
        customised?.customizations?.length || customised?.customization_names,
        `order_create must keep the add-ons (${menu.addOns.join(', ')}) sent in the request`,
      ).toBeTruthy();
      await expect(page.getByText('Your order is in the kitchen')).toBeVisible();
      await expect(page.getByText(`PIN ${tablePin}`)).toBeVisible();
      await snap('05-order-in-kitchen');
    });

    await test.step('second guest joins the table with the PIN and sees the order', async () => {
      if (!withGuest) {
        testInfo.annotations.push({ type: 'skipped step', description: 'second guest (WITH_GUEST=0)' });
        return;
      }
      const guestContext = await browser.newContext(iPhone);
      const guestPage = await guestContext.newPage();
      const guestApi = new ApiRecorder(apiBase);
      guestApi.attach(guestPage);
      const guest = new DineInApp(guestPage, guestApi);
      await guest.openMenu();
      await expect(guestPage.getByText('View Orders and Pay Bill now')).toBeVisible();
      await guest.joinTableWithPin(tablePin);
      await expect(guestPage.getByText(menu.customisableItem)).toBeVisible();
      await testInfo.attach('06-guest-joined', {
        body: await guestPage.screenshot({ path: `reports/screenshots/${target}/06-guest-joined.png` }),
        contentType: 'image/png',
      });
      api.calls.push(...guestApi.calls);
      await guestContext.close();
    });

    let tip = 0;
    await test.step('generate bill: bill matches the cart', async () => {
      await app.generateBill();
      const bill = (await api.last('GET /qr_print/:code')).data.data;
      expect(bill.currency_symbol).toBe('AED');
      expect.soft(bill.order_items_total.net_payable_amount, 'bill total (incl. VAT) must equal the cart total').toBeCloseTo(expectedCart, 2);
      await attachOrderDetails(testInfo, await collectOrderDetails(api, { tip: NaN, charged: NaN, successAmount: NaN, cartTotal: expectedCart }));
      const text = await bodyText();
      if (text.includes('This bill is split')) testInfo.annotations.push({ type: 'split bill', description: 'bill screen opened in split-bill mode' });
      tip = amountAfter(text, /Restaurant Tip/);
      expect(tip, 'a default tip is pre-selected').toBeGreaterThan(0);
      expect.soft(amountAfter(text, /Your total bill/), 'UI total must equal cart + tip').toBeCloseTo(expectedCart + tip, 2);
      await snap('07-bill');
    });

    let charged = 0;
    await test.step('payment method: debit/credit card opens the Telr form', async () => {
      const telr = await app.chooseCardPayment();
      const initiate = (await api.all('POST /initiate_payment/:code')).at(-1)!;
      expect(new URL(initiate.url).searchParams.get('tip')).toBe(String(tip));
      expect((initiate.responseBody as any).data.payment_url).toContain('secure.telr.com');
      await expect(telr.locator('#creditCardNumber')).toBeVisible();
      charged = Number((await telr.locator('#cardpaybutton_v2').innerText()).replace(/[^\d.]/g, ''));
      expect.soft(charged, 'amount charged must equal cart + tip').toBeCloseTo(expectedCart + tip, 2);
      await snap('08-card-form');
    });

    let returnUrl = '';
    let successAmount = NaN;
    await test.step('pay with the test card and land on the success screen', async () => {
      const redirect = page.waitForRequest((r) => r.isNavigationRequest() && r.url().includes('from_pg=true'), { timeout: 120_000 });
      await app.payWithCard();
      returnUrl = (await redirect).url();
      expect(new URL(returnUrl).searchParams.get('status')).toBe('authorised');
      const statuses = await api.all('GET /fetch_payment_status_by_session_id/:code');
      expect((statuses.at(-1)!.responseBody as any).data.payment_status).toBe('payment_success');
      const paid = (await api.last('GET /qr_print/:code')).data.data;
      expect(paid.payment_status).toBe('payment_success');
      expect(Number(paid.tips)).toBe(tip);
      successAmount = amountAfter(await bodyText(), /Paid successfully to [^\n]*?/);
      expect.soft(successAmount, 'success screen must show the amount charged').toBeCloseTo(charged, 2);
      await snap('09-paid');
    });

    await test.step('re-opening the payment return link does not add the tip twice', async () => {
      const bill = page.waitForResponse((r) => r.url().includes('/qr_print/') && r.url().includes('ct='));
      await page.goto(returnUrl);
      await bill;
      await expect(page.getByText('Paid successfully')).toBeVisible();
      expect(Number((await api.last('GET /qr_print/:code')).data.data.tips), 'tip after reload').toBe(tip);
      const text = await bodyText();
      expect.soft(text, 'success screen after reload shows the AED currency').not.toContain('₹');
      expect.soft(text, 'success screen after reload shows the table name').not.toContain('Table undefined');
      await snap('10-paid-after-reload');
    });

    await test.step('record item-level order details', async () => {
      const details = await collectOrderDetails(api, { tip, charged, successAmount, cartTotal: expectedCart });
      await attachOrderDetails(testInfo, details);
    });

    await test.step('feedback: 5 stars with tags is submitted', async () => {
      const response = await app.rate(5, menu.feedbackTags);
      expect(response.status()).toBe(200);
      const sent = (await api.all('POST /post_order_feedback/:code'))[0].requestBody as any;
      expect(sent.rating).toBe(5);
      expect(sent.feedback_tags).toBe('food, prompt_service');
      expect((await response.json()).data.status).toBe('success');
      await snap('11-feedback-submitted');
    });

    await test.step('table is released and every flow API was exercised', async () => {
      expect((await tableState(request)).next_step).toBe('customer_details');
      expect(api.endpoints()).toEqual(expect.arrayContaining(flowEndpoints));
    });

    await test.step('start a new order: fresh menu with an empty cart', async () => {
      const menuCalls = (await api.all('POST /qr_online_order/:code')).length;
      const reloaded = page.waitForResponse((r) => r.url().includes('/qr_online_order/') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Start a new order' }).click();
      await reloaded;
      await expect(app.screen('catalog')).toBeAttached();
      expect(new URL(page.url()).searchParams.get('code')).toBe(qrCode);

      const calls = await api.all('POST /qr_online_order/:code');
      expect(calls.length, 'menu is fetched again').toBe(menuCalls + 1);
      const menuRequest = calls.at(-1)!.requestBody as any;
      expect(menuRequest.user_name, 'customer name is carried into the new order').toBe(customer.name);
      expect(menuRequest.user_mobile_number).toBe(customer.mobile);
      expect((calls.at(-1)!.responseBody as any).data.active_session_data.active_orders, 'no active order after payment').toBe(false);

      await expect(page.getByText(/items? added/), 'cart starts empty').toBeHidden();
      await snap('12-start-new-order');
      await app.openCategory(menu.category);
      await app.addSimpleItem(menu.simpleItem);
      await expect(page.getByText('1 items added'), 'new cart counts from 1').toBeVisible();
      expect((await tableState(request)).next_step, 'table stays free until the new order is sent').toBe('customer_details');
    });
  });
});
