import 'dotenv/config';
import { test as base, expect } from '@playwright/test';
import { CustomerMenuPage } from '../pages/customer/CustomerMenuPage';
import { CartPage } from '../pages/customer/CartPage';
import { CheckoutPage } from '../pages/customer/CheckoutPage';

type Pages = {
  menuPage: CustomerMenuPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
};

export const test = base.extend<Pages>({
  menuPage: async ({ page }, use) => {
    await use(new CustomerMenuPage(page));
  },
  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },
  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },
});

export { expect };

/** Full customer QR URL. Empty when the variable is missing or blank. */
export const qr = (name: string) => process.env[name]?.trim() ?? '';

/** Names that are unset or blank. */
export const missingEnv = (names: string[]) => names.filter((name) => !process.env[name]?.trim());

/**
 * Static skip for the current describe. Call it while the file is loading so Playwright
 * does not launch a browser when required env is absent.
 */
export function skipWithout(names: string[], reason?: string) {
  const missing = missingEnv(names);
  test.skip(
    missing.length > 0,
    reason ?? `Missing env: ${missing.join(', ')}. See .env.example`,
  );
}
