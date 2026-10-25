import { test, qr, skipWithout } from '../../fixtures/test';
import { TablePreference } from '../../data/factories';

// Takeaway (table preference 4).
test.describe('Customer order – Takeaway @takeaway', () => {
  test.skip(!qr('QR_TAKEAWAY'), `QR_TAKEAWAY not set in .env (table preference ${TablePreference.TAKEAWAY})`);

  test('TA-01 scan QR opens menu @smoke @regression', async ({ menuPage }) => {
    await menuPage.openFromQr(qr('QR_TAKEAWAY'));
    await menuPage.expectLoaded();
  });

  test.describe('pay', () => {
    skipWithout(['MENU_SIMPLE_ITEM', 'CARD_NUMBER', 'CARD_EXPIRY', 'CARD_CVV']);

    test('TA-02 place takeaway order and pay @smoke @regression', async ({ menuPage, cartPage, checkoutPage }) => {
      await menuPage.openFromQr(qr('QR_TAKEAWAY'));
      await menuPage.addItem(process.env.MENU_SIMPLE_ITEM ?? '');
      await menuPage.viewCart();
      await cartPage.placeOrder();
      await checkoutPage.pay('success');
      await checkoutPage.expectOrderConfirmed();
    });
  });

  test('TA-03 empty cart cannot be checked out @regression', async ({ menuPage, cartPage }) => {
    await menuPage.openFromQr(qr('QR_TAKEAWAY'));
    await menuPage.viewCart();
    await cartPage.expectSendDisabled();
  });
});
