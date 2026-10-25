import { expect, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';
import { env } from '../../utils/env';

export type CustomerDetails = { name: string; mobile: string };

/**
 * Cart and send-to-kitchen. The swipe, name/mobile fields, and order screen marker
 * match `tests/support/app.ts`.
 */
export class CartPage extends BasePage {
  // qr_menu_v3 renders money as "AED 12.34" (see tests/e2e/dine-in-flow.spec.ts). There is no cart-total test id.
  // TODO(verify-selector): a stable total hook if a table type does not show an AED amount.
  total = this.page.getByText(/AED\s+\d/).first();

  async expectItem(name: string) {
    await expect(this.page.getByText(name, { exact: true }).first()).toBeVisible();
  }

  async setQty(name: string, qty: number) {
    // TODO(verify-selector): cart row container. scroll-item_ is the menu hook; the cart may differ.
    const row = this.page.locator('[resourceid^="scroll-item_"]').filter({ hasText: name }).first();
    const spin = row.getByRole('spinbutton');
    if (await spin.isVisible().catch(() => false)) {
      await spin.fill(String(qty));
      return;
    }
    const current = Number((await row.innerText()).match(/\b(\d+)\b/)?.[1] ?? 1);
    const delta = qty - current;
    const btn = delta >= 0
      ? row.locator('[resourceid^="increment-click-button"]')
      : row.locator('[resourceid^="decrement-click-button"]');
    for (let i = 0; i < Math.abs(delta); i++) await btn.first().click();
  }

  /** Checkout CTA for QSR and takeaway. Dine-in uses sendToKitchen. */
  async placeOrder() {
    const send = this.rid('send-order-to-kitchen-click-button');
    if (await send.isVisible().catch(() => false)) {
      await send.click();
      return;
    }
    // TODO(verify-selector): QSR / takeaway place-order button
    await this.page.getByRole('button', { name: /place order|proceed|pay|send to kitchen/i }).click();
  }

  async sendToKitchen(customer?: CustomerDetails) {
    const name = customer?.name ?? env('CUSTOMER_NAME');
    const mobile = customer?.mobile ?? env('CUSTOMER_MOBILE');
    await this.rid('send-order-to-kitchen-click-button').click();
    await expect(this.page.getByText('Place your order')).toBeVisible();
    await this.rid('name-input-field').fill(name);
    await this.rid('mobile-input-field').fill(mobile);
    const created = this.page.waitForResponse((r) => r.url().includes('/qr_code_order_create/'));
    await this.swipe(this.rid('send-to-kitchen-swipe-button'));
    await created;
    await expect(this.page.locator('[resourceid="screen-render-marker_order"]')).toBeAttached({ timeout: 30_000 });
    await expect(this.page.getByText('Your order is in the kitchen')).toBeVisible();
  }

  async expectSendDisabled() {
    const send = this.rid('send-order-to-kitchen-click-button');
    if (await send.count()) {
      await expect(send).toBeDisabled();
      return;
    }
    // TODO(verify-selector): empty-cart checkout control when send-order-to-kitchen-click-button is absent
    await expect(this.page.getByRole('button', { name: /place order|proceed|pay|send to kitchen/i }).first()).toBeDisabled();
  }

  /** Synthetic left-to-right drag across the swipe track (same gesture as tests/support/app.ts). */
  private async swipe(track: Locator) {
    await track.evaluate(async (el) => {
      const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const handle = el.firstElementChild ?? el;
      const rect = el.getBoundingClientRect();
      const fire = (type: string, x: number) =>
        handle.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x }));
      fire('mousedown', rect.left);
      await wait(50);
      fire('mousemove', rect.left + rect.width);
      await wait(50);
      fire('mouseup', rect.left + rect.width);
    });
  }
}
