export type Target = 'java' | 'ruby';

export const JAVA_API = process.env.JAVA_API ?? 'https://dine-in-service-staging.paytmcheckout.com';
export const RUBY_API = process.env.RUBY_API ?? 'https://biz.test.paytmcheckout.com';
export const WEB_BASE = process.env.WEB_BASE ?? 'https://biz.test.paytmcheckout.com';

export const target: Target = process.env.TARGET === 'ruby' ? 'ruby' : 'java';
export const qrCode = process.env.QR_CODE ?? 'zeFdKxA86l';

/** The API host every customer-UI call is expected to hit for the selected target. */
export const apiBase = target === 'java' ? JAVA_API : RUBY_API;
export const menuPath = target === 'java' ? '/qr_menu_v3/' : '/qr_menu/';
export const menuUrl = `${WEB_BASE}${menuPath}?code=${qrCode}`;

export const customer = {
  name: process.env.CUSTOMER_NAME ?? 'QA Regression',
  mobile: process.env.CUSTOMER_MOBILE ?? '501234567',
  countryCode: '+971',
};
/** The table PIN shown to other guests is the last 4 digits of the host's mobile number. */
export const tablePin = customer.mobile.slice(-4);

export const card = {
  number: process.env.CARD_NUMBER ?? '4000000000000002',
  expiry: process.env.CARD_EXPIRY ?? '0628',
  cvv: process.env.CARD_CVV ?? '123',
};

/** Ruby's /qr_menu/ build splits the bill once a second guest joins, so the baseline runs single-payer. */
export const withGuest = process.env.WITH_GUEST !== '0';

export const menu = {
  category: 'Offers',
  simpleItem: 'Dahi ke Kebab',
  customisableItem: 'Paneer Dum Biryani',
  addOns: ['Biryani Salan Dip', 'Special Spiced Dates'],
  feedbackTags: ['Food', 'Prompt Service'],
};

/** Endpoints the Figma flow must exercise (normalised by ApiRecorder.endpointOf). */
export const flowEndpoints = [
  'POST /qr_online_order/:code',
  'GET /qr_online_order/:code/items/:id/options',
  'POST /qr_recommended_items/:code',
  'GET /view_cart',
  'POST /qr_code_order_create/:code',
  'GET /customer_orders/:code',
  'GET /qr_print/:code',
  'POST /initiate_payment/:code',
  'POST /api/http_logs',
  'POST /qr_orders/add_tip/:code',
  'GET /fetch_payment_status_by_session_id/:code',
  'POST /post_order_feedback/:code',
];

export const aed = (amount: number) => `AED ${amount.toFixed(2)}`;
export const round2 = (n: number) => Math.round(n * 100) / 100;
