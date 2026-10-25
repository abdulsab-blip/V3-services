# Customer selector alignment

Re-checked against `tests/support/app.ts` and `tests/e2e/dine-in-flow.spec.ts` in this repo (qr_menu_v3).

## Matches the current dine-in UI

- `screen-render-marker_catalog`, `_order`, `_paybill` (attached, not treated as a visible control)
- `scroll-category_*`, `scroll-item_*`, `add-cart-click-button_*`
- `increment-click-button`, `decrement-click-button`
- `customisation-submit-click-button`
- `send-order-to-kitchen-click-button`, `name-input-field`, `mobile-input-field`, `send-to-kitchen-swipe-button`
- `generate-bill-click-button`
- Welcome button `Start Your Order`, cart pill `items added`, search placeholder `Search menu...`
- Pay bill entry: `Got it`, `Pay your bill`, button `Pay bill`
- Card sheet: `Change`, `Select payment method`, `Debit/Credit Cards`
- Telr iframe `secure.telr.com`: `#creditCardNumber`, `#creditCardExp`, `#cardCVV`, `#cardpaybutton_v2`
- Return URL `from_pg=true`, copy `Paid successfully`, `Your order is in the kitchen`, `Place your order`
- Error hook `error-screen-message` and copy `doesn't seem to work`
- Amounts shown as `AED`

Send to kitchen waits for `POST /qr_code_order_create/`. Card pay waits for `POST /initiate_payment/` and the payment return URL. A second quantity uses the increment control after the first add.

## Still unverified (`TODO(verify-selector)`)

- QSR prepaid, takeaway, and view-and-pay-bill controls that are not the dine-in hooks (place-order, non-Telr pay, empty-cart disabled state, out-of-stock label)
- Split-bill stepper
- Payment failure and timeout screens, and sandbox cards that force those outcomes (`CARD_NUMBER_FAILURE`, `CARD_NUMBER_TIMEOUT`)
- Cart row container and spinbutton quantity editor
- A dedicated cart-total hook (`getByTestId('cart-total')` is not in this UI)
- QR URLs (`QR_QSR`, `QR_DINEIN`, `QR_PAYBILL`, `QR_TAKEAWAY`, `QR_EXPIRED`) and menu item names (`MENU_SIMPLE_ITEM`, `MENU_SECOND_ITEM`, `MENU_OOS_ITEM`, `MENU_CATEGORY`)

Tests skip while those env vars are empty.
