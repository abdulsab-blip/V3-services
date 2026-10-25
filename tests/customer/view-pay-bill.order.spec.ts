import { test, qr, skipWithout } from '../../fixtures/test';
import { TablePreference } from '../../data/factories';

// View and pay bill (table preference 3). Bill entry uses qr_menu_v3 pay-bill hooks when present.
test.describe('Customer order – View and pay bill @paybill', () => {
  test.skip(!qr('QR_PAYBILL'), `QR_PAYBILL not set in .env (table preference ${TablePreference.VIEW_AND_PAY_BILL})`);

  test('PB-01 scan QR opens menu @smoke @regression', async ({ menuPage }) => {
    await menuPage.openFromQr(qr('QR_PAYBILL'));
    await menuPage.expectLoaded();
  });

  test.describe('pay', () => {
    skipWithout(['CARD_NUMBER', 'CARD_EXPIRY', 'CARD_CVV']);

    test('PB-02 view bill and pay full amount @smoke @regression', async ({ menuPage, checkoutPage }) => {
      await menuPage.openFromQr(qr('QR_PAYBILL'));
      await menuPage.viewBill();
      await checkoutPage.pay('success');
      await checkoutPage.expectBillPaid();
    });

    test('PB-03 split bill between 3 payers @regression', async ({ menuPage, checkoutPage }) => {
      await menuPage.openFromQr(qr('QR_PAYBILL'));
      await menuPage.viewBill();
      await checkoutPage.splitBill(3);
      await checkoutPage.pay('success');
    });
  });

  test.describe('payment failure', () => {
    skipWithout(['CARD_NUMBER_FAILURE', 'CARD_EXPIRY', 'CARD_CVV']);

    test('PB-04 payment failure leaves bill open @regression', async ({ menuPage, checkoutPage }) => {
      await menuPage.openFromQr(qr('QR_PAYBILL'));
      await menuPage.viewBill();
      await checkoutPage.pay('failure');
      await checkoutPage.expectPaymentFailed();
    });
  });
});
