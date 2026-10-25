import { test, qr } from '../../fixtures/test';

test.describe('Invalid / expired QR @qr', () => {
  test.describe('expired', () => {
    test.skip(!qr('QR_EXPIRED'), 'QR_EXPIRED not set');

    test('QR-01 expired QR shows error @regression', async ({ menuPage }) => {
      await menuPage.openFromQr(qr('QR_EXPIRED'));
      await menuPage.expectInvalidQr();
    });
  });

  test.describe('tampered', () => {
    test.skip(!qr('QR_DINEIN'), 'QR_DINEIN not set');

    test('QR-02 tampered QR token shows error @regression', async ({ menuPage }) => {
      await menuPage.openFromQr(`${qr('QR_DINEIN')}tampered`);
      await menuPage.expectInvalidQr();
    });
  });
});
