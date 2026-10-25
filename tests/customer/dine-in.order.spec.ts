import { test, qr, skipWithout } from '../../fixtures/test';
import { TablePreference } from '../../data/factories';

// Dine-in (table preference 2). Selectors follow qr_menu_v3 resource ids in tests/support/app.ts.
test.describe('Customer order – Dine-in @dinein', () => {
  test.skip(!qr('QR_DINEIN'), `QR_DINEIN not set in .env (table preference ${TablePreference.DINE_IN})`);

  test('DIN-01 scan QR opens menu @smoke @regression', async ({ menuPage }) => {
    await menuPage.openFromQr(qr('QR_DINEIN'));
    await menuPage.expectLoaded();
  });

  test.describe('send to kitchen', () => {
    skipWithout(['MENU_SIMPLE_ITEM', 'CUSTOMER_NAME', 'CUSTOMER_MOBILE']);

    test('DIN-02 place first order to table (pay later) @smoke @regression', async ({ menuPage, cartPage }) => {
      const item = process.env.MENU_SIMPLE_ITEM ?? '';
      await menuPage.openFromQr(qr('QR_DINEIN'));
      if (process.env.MENU_CATEGORY) await menuPage.openCategory(process.env.MENU_CATEGORY);
      await menuPage.addItem(item);
      await menuPage.viewCart();
      await cartPage.expectItem(item);
      await cartPage.sendToKitchen();
    });
  });

  test.describe('running order', () => {
    skipWithout(['MENU_SIMPLE_ITEM', 'MENU_SECOND_ITEM', 'CUSTOMER_NAME', 'CUSTOMER_MOBILE']);

    test('DIN-03 add items to running order @regression', async ({ menuPage, cartPage }) => {
      const item = process.env.MENU_SIMPLE_ITEM ?? '';
      const item2 = process.env.MENU_SECOND_ITEM ?? '';
      await menuPage.openFromQr(qr('QR_DINEIN'));
      if (process.env.MENU_CATEGORY) await menuPage.openCategory(process.env.MENU_CATEGORY);
      await menuPage.addItem(item);
      await menuPage.viewCart();
      await cartPage.sendToKitchen();
      await menuPage.openFromQr(qr('QR_DINEIN'));
      await menuPage.addItem(item2, 2);
      await menuPage.viewCart();
      await cartPage.sendToKitchen();
    });
  });

  test.describe('card pay', () => {
    skipWithout(['CARD_NUMBER', 'CARD_EXPIRY', 'CARD_CVV']);

    test('DIN-04 generate bill and pay by card @smoke @regression', async ({ menuPage, checkoutPage }) => {
      await menuPage.openFromQr(qr('QR_DINEIN'));
      await menuPage.viewBill();
      await checkoutPage.generateBill();
      await checkoutPage.pay('success');
      await checkoutPage.expectBillPaid();
      await checkoutPage.expectFlow(TablePreference.DINE_IN);
    });
  });
});
