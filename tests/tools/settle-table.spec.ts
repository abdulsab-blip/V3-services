import { test, expect } from '../support/fixtures';
import { apiBase, qrCode, tablePin } from '../support/config';

test('settle an open table session by paying the full bill', async ({ app, api, request }, testInfo) => {
  const state = async () => (await (await request.get(`${apiBase}/view_cart/?code=${qrCode}`)).json()).data.next_step;
  test.skip((await state()) === 'customer_details', 'table is already free');

  await app.openMenu();
  await app.joinTableWithPin(tablePin);
  await app.generateBill();
  const telr = await app.chooseCardPayment();
  const bill = (await api.last('GET /qr_print/:code')).data.data;
  await testInfo.attach('settled-order.json', {
    contentType: 'application/json',
    body: JSON.stringify({
      charged: await telr.locator('#cardpaybutton_v2').innerText(),
      totals: bill.order_items_total,
      tips: bill.tips,
      items: bill.order_items.map((i: any) => ({ name: i.item_name, quantity: i.quantity, price: i.price, total: i.total_price, add_ons: i.customization_names })),
    }, null, 2),
  });
  await app.payWithCard();
  expect(await state()).toBe('customer_details');
});
