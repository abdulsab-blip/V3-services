import { expect, type Locator, type Page } from '@playwright/test';

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /** Exact `resourceid`, or the suffixed form used by qr_menu_v3 (`add-cart-click-button_15514`). */
  protected rid(id: string): Locator {
    return this.page.locator(`[resourceid="${id}"], [resourceid^="${id}_"]`);
  }

  // TODO(verify-selector): toast/alert component for success and error messages
  get toast() {
    return this.page.getByRole('alert');
  }

  async expectToast(text: string | RegExp) {
    await expect(this.toast).toContainText(text);
  }

  async openMenu(menu: string, sub?: string) {
    // TODO(verify-selector): side nav structure (link vs button)
    await this.page.getByRole('link', { name: menu }).first().click();
    if (sub) await this.page.getByRole('link', { name: sub }).first().click();
  }
}
