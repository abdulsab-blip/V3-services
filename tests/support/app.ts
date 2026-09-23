import { expect, type Locator, type Page } from '@playwright/test';
import { card as defaultCard, customer as defaultCustomer, menuUrl } from './config';
import type { ApiRecorder } from './network';

/** `resourceid` attributes are the app's own automation hooks; ids with a suffix look like `add-cart-click-button_15514`. */
const rid = (page: Page, id: string) => page.locator(`[resourceid="${id}"], [resourceid^="${id}_"]`);

export class DineInApp {
  constructor(readonly page: Page, readonly api: ApiRecorder) {}

  screen(name: string) {
    return this.page.locator(`[resourceid="screen-render-marker_${name}"]`);
  }

  async openMenu(url = menuUrl) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const menuLoaded = this.page.waitForResponse((r) => r.url().includes('/qr_online_order/') && r.request().method() === 'POST', { timeout: 60_000 });
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      await menuLoaded.catch(() => undefined);
      const outcome = await Promise.race([
        this.screen('catalog').waitFor({ state: 'attached', timeout: 30_000 }).then(() => 'ok'),
        rid(this.page, 'error-screen-message').waitFor({ state: 'attached', timeout: 30_000 }).then(() => 'error'),
      ]);
      if (outcome === 'ok') return;
    }
    throw new Error('Menu did not load after 3 attempts ("This QR doesn\'t seem to work")');
  }

  async dismissWelcome() {
    const start = this.page.getByRole('button', { name: 'Start Your Order' });
    if (await start.isVisible().catch(() => false)) await start.click();
    await expect(start).toBeHidden();
  }

  menuItem(name: string): Locator {
    return this.page
      .locator('[resourceid^="scroll-item_"]')
      .filter({ has: this.page.getByText(name, { exact: true }) })
      .first();
  }

  async openCategory(name: string) {
    await this.page.locator('[resourceid^="scroll-category_"]').getByText(name, { exact: true }).first().click();
  }

  async addSimpleItem(name: string) {
    const item = this.menuItem(name);
    await item.locator('[resourceid^="add-cart-click-button_"]').click();
    await expect(item.locator('[resourceid^="increment-click-button"], [resourceid^="decrement-click-button"]').first()).toBeVisible();
  }

  async addCustomisedItem(name: string, addOns: string[]) {
    const options = this.page.waitForResponse((r) => /\/items\/\d+\/options/.test(r.url()));
    await this.menuItem(name).locator('[resourceid^="add-cart-click-button_"]').click();
    await options;
    const submit = rid(this.page, 'customisation-submit-click-button');
    await expect(submit).toBeVisible();
    for (const addOn of addOns) await this.page.getByText(addOn, { exact: true }).click();
    await submit.click();
    await expect(submit).toBeHidden();
  }

  async openCart() {
    const recommended = this.page.waitForResponse((r) => r.url().includes('/qr_recommended_items/'));
    await this.page.getByText(/items? added/).click();
    await recommended;
    await expect(rid(this.page, 'send-order-to-kitchen-click-button')).toBeVisible();
  }

  async sendToKitchen(customer = defaultCustomer) {
    await rid(this.page, 'send-order-to-kitchen-click-button').click();
    await expect(this.page.getByText('Place your order')).toBeVisible();
    await rid(this.page, 'name-input-field').fill(customer.name);
    await rid(this.page, 'mobile-input-field').fill(customer.mobile);
    const created = this.page.waitForResponse((r) => r.url().includes('/qr_code_order_create/'));
    await this.swipe(rid(this.page, 'send-to-kitchen-swipe-button'));
    await created;
    await expect(this.screen('order')).toBeAttached({ timeout: 30_000 });
  }

  /** Mirrors the app's own automation: a synthetic left-to-right mouse drag across the swipe track. */
  private async swipe(track: Locator) {
    await track.evaluate(async (el) => {
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const handle = el.firstElementChild ?? el;
      const rect = el.getBoundingClientRect();
      const fire = (type: string, x: number) => handle.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x }));
      fire('mousedown', rect.left);
      await wait(50);
      fire('mousemove', rect.left + rect.width);
      await wait(50);
      fire('mouseup', rect.left + rect.width);
    });
  }

  async joinTableWithPin(pin: string) {
    const tableInUse = this.page.getByRole('button', { name: 'Got it' });
    if (await tableInUse.isVisible().catch(() => false)) await tableInUse.click();
    const welcomePayBill = this.page.getByText('Pay your bill', { exact: true });
    if (await welcomePayBill.isVisible().catch(() => false)) await welcomePayBill.click();
    else await this.page.getByRole('button', { name: 'Pay bill' }).click();
    const pinPrompt = this.page.getByText("Join your table's order");
    await expect(pinPrompt.or(this.screen('order')).first()).toBeAttached({ timeout: 30_000 });
    if (!(await pinPrompt.isVisible())) return;
    for (const [i, digit] of [...pin].entries()) {
      await this.page.getByLabel(`PIN digit ${i + 1}`).fill(digit);
    }
    const join = this.page.getByRole('button', { name: 'Join Table' });
    await expect(join).toBeEnabled();
    await join.click();
    await expect(this.screen('order')).toBeAttached({ timeout: 30_000 });
  }

  async generateBill() {
    const bill = this.page.waitForResponse((r) => r.url().includes('/qr_print/'));
    await rid(this.page, 'generate-bill-click-button').click();
    await bill;
    await expect(this.screen('paybill')).toBeAttached();
  }

  async chooseCardPayment() {
    const initiated = this.page.waitForResponse((r) => r.url().includes('/initiate_payment/'));
    await this.page.getByRole('button', { name: 'Change' }).click();
    await expect(this.page.getByText('Select payment method')).toBeVisible();
    await this.page.getByText('Debit/Credit Cards').click();
    await initiated;
    return this.page.frameLocator('iframe[src*="secure.telr.com"]');
  }

  async payWithCard(payment = defaultCard) {
    const telr = this.page.frameLocator('iframe[src*="secure.telr.com"]');
    await telr.locator('#creditCardNumber').pressSequentially(payment.number, { delay: 40 });
    await telr.locator('#creditCardExp').pressSequentially(payment.expiry, { delay: 40 });
    await telr.locator('#cardCVV').pressSequentially(payment.cvv, { delay: 40 });
    await telr.locator('#cardpaybutton_v2').click();
    await this.page.waitForURL(/from_pg=true/, { timeout: 120_000 });
    await expect(this.page.getByText('Paid successfully')).toBeVisible({ timeout: 120_000 });
  }

  async rate(stars: number, tags: string[]) {
    await this.page.getByRole('button', { name: `Rate ${stars} stars` }).first().click();
    await expect(this.page.getByText('How was your experience?')).toBeVisible();
    for (const tag of tags) await this.page.getByRole('button', { name: tag, exact: true }).click();
    const posted = this.page.waitForResponse((r) => r.url().includes('/post_order_feedback/'));
    await this.page.getByRole('button', { name: 'Submit', exact: true }).click();
    return posted;
  }
}
