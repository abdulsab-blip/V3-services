import { test, qr, skipWithout } from '../../fixtures/test';
import { TablePreference } from '../../data/factories';

// QSR prepaid (table preference 1). Shared qr_menu_v3 hooks are used when present.
// QSR-specific controls stay on the TODO(verify-selector) fallbacks.
test.describe('Customer order – QSR prepaid @qsr', () => {
  test.skip(!qr('QR_QSR'), `QR_QSR not set in .env (table preference ${TablePreference.QSR_PREPAID})`);

  test('QSR-01 scan QR opens menu @smoke @regression', async ({ menuPage }) => {
    await menuPage.openFromQr(qr('QR_QSR'));
    await menuPage.expectLoaded();
  });

  test.describe('pay', () => {
    skipWithout(['MENU_SIMPLE_ITEM', 'CARD_NUMBER', 'CARD_EXPIRY', 'CARD_CVV']);

    test('QSR-02 place order and pay successfully @smoke @regression', async ({ menuPage, cartPage, checkoutPage }) => {
      await menuPage.openFromQr(qr('QR_QSR'));
      await menuPage.addItem(process.env.MENU_SIMPLE_ITEM ?? '');
      await menuPage.viewCart();
      await cartPage.placeOrder();
      await checkoutPage.pay('success');
      await checkoutPage.expectOrderConfirmed();
    });
  });

  test.describe('payment failure', () => {
    // Failure forcing is unverified until a sandbox card is provided.
    skipWithout(['MENU_SIMPLE_ITEM', 'CARD_NUMBER_FAILURE', 'CARD_EXPIRY', 'CARD_CVV']);

    test('QSR-03 payment failure keeps order unconfirmed @regression', async ({ menuPage, cartPage, checkoutPage }) => {
      await menuPage.openFromQr(qr('QR_QSR'));
      await menuPage.addItem(process.env.MENU_SIMPLE_ITEM ?? '');
      await menuPage.viewCart();
      await cartPage.placeOrder();
      await checkoutPage.pay('failure');
      await checkoutPage.expectPaymentFailed();
    });
  });

  // PG sandbox timeout is not wired. Listed, not executed.
  test.fixme('QSR-04 payment timeout handled @regression', async ({ menuPage, cartPage, checkoutPage }) => {
    await menuPage.openFromQr(qr('QR_QSR'));
    await menuPage.addItem(process.env.MENU_SIMPLE_ITEM ?? '');
    await menuPage.viewCart();
    await cartPage.placeOrder();
    await checkoutPage.pay('timeout');
  });

  test.describe('out of stock', () => {
    skipWithout(['MENU_OOS_ITEM']);

    test('QSR-05 out-of-stock item cannot be added @regression', async ({ menuPage }) => {
      await menuPage.openFromQr(qr('QR_QSR'));
      await menuPage.expectOutOfStock(process.env.MENU_OOS_ITEM ?? '');
    });
  });
});
