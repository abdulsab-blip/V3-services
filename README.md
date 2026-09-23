# Dine-in QR (qr_menu_v3) regression suite

Playwright suite that verifies the customer dine-in flow after the Ruby → Java migration:
every API call from `https://biz.test.paytmcheckout.com/qr_menu_v3/?code=zeFdKxA86l` must go to
`https://dine-in-service-staging.paytmcheckout.com`, and must behave like the Ruby API it replaces.

## Run

```bash
npm install
npm test                    # API + end-to-end
npm run test:api            # contract + Ruby/Java parity (read-only, no orders created)
npm run test:e2e            # full flow against Java: places an order and pays with the Telr test card
npm run test:ruby-baseline  # same flow through the old /qr_menu/ UI (Ruby APIs), as a control
npm run report              # HTML report with per-step screenshots and api-calls.json
```

Requires Google Chrome (the bundled Playwright browser download is blocked by the corporate proxy)
and the VPN. `NODE_OPTIONS=--use-system-ca` in the scripts lets Node trust the corporate root CA.

## What is covered

| Spec | Checks |
| --- | --- |
| `tests/e2e/dine-in-flow.spec.ts` | Welcome sheet → menu → simple item → customisable item with add-ons → cart → customer details + swipe → order in kitchen → second guest joins with PIN → generate bill → card payment (Telr) → success → re-open return link (tip not added twice) → 5-star feedback → table released. Fails if any API call leaves the expected host, fails, or a flow endpoint is never called. |
| `tests/e2e/linked-recommended.spec.ts` | Soups & Snacks → Onion Samosa: "Complete your meal" linked-items sheet, adding a linked item, "Often bought with" recommendations, cart "Bestseller". Expected items come from the Ruby menu. On Java a diagnostic run injects Ruby's ids into the Java menu response to separate API vs frontend faults. No order is placed. |
| `tests/api/contract.spec.ts` | CORS preflight for all 14 endpoints the bundle can call, menu/options/recommendations/cart-preview/session responses, 422 error paths. |
| `tests/api/parity.spec.ts` | Field-by-field diff of Ruby vs Java for read-only endpoints (diff attached to the report). |

Configuration (QR code, customer, card, menu items, hosts) lives in `tests/support/config.ts` and can be
overridden with env vars (`QR_CODE`, `CARD_NUMBER`, `CARD_EXPIRY`, `CARD_CVV`, `CUSTOMER_MOBILE`, `JAVA_API`, ...).
If a previous run left the table open, the e2e test settles it (joins with the PIN and pays) before starting; `npm run settle-table` does the same on demand.
The Excel report is rebuilt with `python3 reports/build_report.py` from `reports/runs/*.json` and `reports/screenshots/`.
