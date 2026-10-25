import { expect, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Customer menu. Dine-in hooks match `tests/support/app.ts` (qr_menu_v3):
 * screen markers, scroll-category / scroll-item, add-cart, welcome sheet, error screen.
 * Role and text fallbacks are only for table types that do not use those hooks.
 */
export class CustomerMenuPage extends BasePage {
  screen(name: string) {
    return this.page.locator(`[resourceid="screen-render-marker_${name}"]`);
  }

  async openFromQr(qrUrl: string) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const menuLoaded = this.page
        .waitForResponse(
          (r) => r.url().includes('/qr_online_order/') && r.request().method() === 'POST',
          { timeout: 60_000 },
        )
        .catch(() => undefined);
      await this.page.goto(qrUrl, { waitUntil: 'domcontentloaded' });
      await menuLoaded;
      const outcome = await new Promise<'ok' | 'error' | 'unknown'>((resolve) => {
        const timer = setTimeout(() => resolve('unknown'), 30_000);
        const finish = (value: 'ok' | 'error') => {
          clearTimeout(timer);
          resolve(value);
        };
        const watch = (p: Promise<unknown>, value: 'ok' | 'error') => {
          p.then(() => finish(value)).catch(() => undefined);
        };
        watch(this.screen('catalog').waitFor({ state: 'attached', timeout: 30_000 }), 'ok');
        watch(this.rid('error-screen-message').waitFor({ state: 'attached', timeout: 30_000 }), 'error');
        watch(this.page.getByPlaceholder('Search menu...').waitFor({ state: 'visible', timeout: 30_000 }), 'ok');
        watch(
          this.page.getByText(/doesn't seem to work|invalid|expired|not found/i).waitFor({ state: 'visible', timeout: 30_000 }),
          'error',
        );
      });
      if (outcome === 'ok') {
        await this.dismissWelcomeIfPresent();
        return;
      }
      if (outcome === 'error') return;
    }
  }

  async dismissWelcomeIfPresent() {
    const start = this.page.getByRole('button', { name: 'Start Your Order' });
    if (await start.isVisible().catch(() => false)) {
      await start.click();
      await expect(start).toBeHidden();
    }
  }

  async expectLoaded() {
    const catalog = this.screen('catalog');
    const search = this.page.getByPlaceholder('Search menu...');
    await expect(catalog.or(search).first()).toBeAttached({ timeout: 30_000 });
    if (await catalog.count()) await expect(search).toBeVisible();
  }

  async expectInvalidQr() {
    const err = this.rid('error-screen-message');
    const text = this.page.getByText(/doesn't seem to work|invalid|expired|not found/i);
    await expect(err.or(text).first()).toBeAttached({ timeout: 30_000 });
  }

  menuItem(name: string): Locator {
    return this.page
      .locator('[resourceid^="scroll-item_"]')
      .filter({ has: this.page.getByText(name, { exact: true }) })
      .first();
  }

  async openCategory(name: string) {
    const byRid = this.page.locator('[resourceid^="scroll-category_"]').getByText(name, { exact: true }).first();
    if (await byRid.isVisible().catch(() => false)) {
      await byRid.click();
      return;
    }
    // TODO(verify-selector): category chip when scroll-category_ is absent
    await this.page.getByText(name, { exact: true }).first().click();
  }

  async addItem(name: string, qty = 1) {
    const byRid = this.menuItem(name);
    const addBtn = byRid.locator('[resourceid^="add-cart-click-button_"]').first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      const submit = this.rid('customisation-submit-click-button');
      if (await submit.isVisible().catch(() => false)) {
        await submit.click();
        await expect(submit).toBeHidden();
      } else {
        await expect(
          byRid.locator('[resourceid^="increment-click-button"], [resourceid^="decrement-click-button"]').first(),
        ).toBeVisible();
      }
      const increment = byRid.locator('[resourceid^="increment-click-button"]').first();
      for (let i = 1; i < qty; i++) await increment.click();
      return;
    }
    // TODO(verify-selector): add control on menus that do not render add-cart-click-button_
    const fallback = this.page.getByRole('listitem').filter({ hasText: name }).getByRole('button', { name: /add|\+/i }).first();
    for (let i = 0; i < qty; i++) await fallback.click();
  }

  async expectOutOfStock(name: string) {
    // TODO(verify-selector): out-of-stock label. qr_menu_v3 has no dedicated resource id for it.
    await expect(this.menuItem(name).getByText(/out of stock|unavailable/i)).toBeVisible();
  }

  async viewCart() {
    const pill = this.page.getByText(/items? added/);
    if (await pill.isVisible().catch(() => false)) {
      const recommended = this.page
        .waitForResponse((r) => r.url().includes('/qr_recommended_items/'), { timeout: 30_000 })
        .catch(() => undefined);
      await pill.click();
      await Promise.race([
        recommended,
        this.rid('send-order-to-kitchen-click-button').waitFor({ state: 'visible', timeout: 30_000 }).catch(() => undefined),
      ]);
      return;
    }
    // TODO(verify-selector): cart entry when the "N items added" pill is absent
    await this.page.getByRole('button', { name: /cart|view order/i }).click();
  }

  async viewBill() {
    const generate = this.rid('generate-bill-click-button');
    if (await generate.isVisible().catch(() => false)) {
      await generate.click();
      await expect(this.screen('paybill')).toBeAttached({ timeout: 30_000 });
      return;
    }
    const tableInUse = this.page.getByRole('button', { name: 'Got it' });
    if (await tableInUse.isVisible().catch(() => false)) await tableInUse.click();
    const welcomePayBill = this.page.getByText('Pay your bill', { exact: true });
    if (await welcomePayBill.isVisible().catch(() => false)) {
      await welcomePayBill.click();
      return;
    }
    const payBill = this.page.getByRole('button', { name: 'Pay bill' });
    if (await payBill.isVisible().catch(() => false)) {
      await payBill.click();
      return;
    }
    // TODO(verify-selector): view-bill entry on table types other than qr_menu_v3 dine-in
    await this.page.getByRole('button', { name: /pay bill|view bill/i }).click();
  }
}
