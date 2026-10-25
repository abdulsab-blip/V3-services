import { expect } from '@playwright/test';
import { BasePage } from '../BasePage';
import { TablePreference } from '../../data/factories';
import { env } from '../../utils/env';

export type PaymentOutcome = 'success' | 'failure' | 'timeout';

/**
 * Bill and Telr card pay. Generate Bill, the payment-method sheet, and the Telr
 * iframe ids match `tests/support/app.ts`. Forcing a failure or timeout is not wired.
 */
export class CheckoutPage extends BasePage {
  async generateBill() {
    const marker = this.page.locator('[resourceid="screen-render-marker_paybill"]');
    if ((await marker.count()) > 0) {
      await expect(marker).toBeAttached();
      return;
    }
    const bill = this.page
      .waitForResponse((r) => r.url().includes('/qr_print/'), { timeout: 60_000 })
      .catch(() => undefined);
    const generate = this.rid('generate-bill-click-button');
    if (await generate.isVisible().catch(() => false)) {
      await generate.click();
    } else {
      // TODO(verify-selector): bill CTA when generate-bill-click-button is absent
      await this.page.getByRole('button', { name: /generate bill|view bill|pay bill/i }).first().click();
    }
    await bill;
    await expect(marker).toBeAttached({ timeout: 30_000 });
  }

  async chooseCardPayment() {
    const change = this.page.getByRole('button', { name: 'Change' });
    if (await change.isVisible().catch(() => false)) {
      await change.click();
      await expect(this.page.getByText('Select payment method')).toBeVisible();
      const initiated = this.page.waitForResponse((r) => r.url().includes('/initiate_payment/'));
      await this.page.getByText('Debit/Credit Cards').click();
      await initiated;
    }
    const telr = this.page.frameLocator('iframe[src*="secure.telr.com"]');
    await expect(telr.locator('#creditCardNumber')).toBeVisible();
    return telr;
  }

  /**
   * Success uses CARD_NUMBER / CARD_EXPIRY / CARD_CVV and the Telr test form.
   * Failure and timeout read CARD_NUMBER_FAILURE / CARD_NUMBER_TIMEOUT when set.
   * Those sandbox cards are not verified against this checkout.
   */
  async pay(outcome: PaymentOutcome = 'success') {
    const number = cardNumberFor(outcome);
    const expiry = env('CARD_EXPIRY');
    const cvv = env('CARD_CVV');
    const telrFrame = this.page.frameLocator('iframe[src*="secure.telr.com"]');
    const cardField = telrFrame.locator('#creditCardNumber');
    const changeVisible = await this.page.getByRole('button', { name: 'Change' }).isVisible().catch(() => false);
    const cardVisible = await cardField.isVisible().catch(() => false);
    if (cardVisible || changeVisible) {
      const telr = cardVisible ? telrFrame : await this.chooseCardPayment();
      if (cardVisible) await expect(telr.locator('#creditCardNumber')).toBeVisible();
      await telr.locator('#creditCardNumber').pressSequentially(number, { delay: 40 });
      await telr.locator('#creditCardExp').pressSequentially(expiry, { delay: 40 });
      await telr.locator('#cardCVV').pressSequentially(cvv, { delay: 40 });
      await telr.locator('#cardpaybutton_v2').click();
      if (outcome === 'success') await this.page.waitForURL(/from_pg=true/, { timeout: 120_000 });
      return;
    }
    // TODO(verify-selector): non-Telr pay button (QSR, takeaway, view-and-pay-bill)
    await this.page.getByRole('button', { name: /pay/i }).last().click();
  }

  async splitBill(parts: number) {
    // TODO(verify-selector): split control. The dine-in bill can show "This bill is split" but the stepper is unmapped.
    const splitBtn = this.page.getByRole('button', { name: /split/i });
    if (await splitBtn.isVisible().catch(() => false)) {
      await splitBtn.click();
      const label = this.page.getByLabel(/split|people|ways/i);
      if (await label.isVisible().catch(() => false)) await label.fill(String(parts));
    }
  }

  async expectOrderConfirmed() {
    // "Your order is in the kitchen" is the qr_menu_v3 copy. The other phrases are unverified.
    // TODO(verify-selector): QSR / takeaway confirmation copy
    await expect(this.page.getByText(/Your order is in the kitchen|order (placed|confirmed)/i)).toBeVisible({
      timeout: 60_000,
    });
  }

  async expectPaymentFailed() {
    // TODO(verify-selector): payment-failed state. No qr_menu_v3 resource id or copy is confirmed.
    await expect(this.page.getByText(/payment failed|retry/i)).toBeVisible({ timeout: 60_000 });
  }

  async expectBillPaid() {
    // "Paid successfully" is the qr_menu_v3 return screen. Other phrases are unverified.
    // TODO(verify-selector): success copy if it differs from "Paid successfully"
    await expect(this.page.getByText(/Paid successfully|bill paid|payment successful/i)).toBeVisible({
      timeout: 120_000,
    });
  }

  async expectFlow(pref: TablePreference) {
    if (pref === TablePreference.DINE_IN) {
      await expect(this.page.getByText(/You are on table|PIN /i).first()).toBeVisible();
    }
  }
}

function cardNumberFor(outcome: PaymentOutcome): string {
  if (outcome === 'failure') return env('CARD_NUMBER_FAILURE');
  if (outcome === 'timeout') return env('CARD_NUMBER_TIMEOUT');
  return env('CARD_NUMBER');
}
