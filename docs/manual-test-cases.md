# Paytm Pay and Order – Manual Test Cases (customer)

Customer modules only. Table preferences: **1 = QSR prepaid, 2 = Dine-in, 3 = View and pay bill, 4 = Takeaway**.

Automated titles in `tests/customer` start with the ID in **Automation mapping**. Admin, outlet setup, and concurrency cases are not in this suite.

| Module | Cases |
|---|---|
| QSR Prepaid (1) | 10 |
| Dine-in (2) | 10 |
| View & Pay Bill (3) | 7 |
| Takeaway (4) | 6 |
| QR Code | 5 |

DIN-01, PB-01, and TA-01 are the scan-QR smokes from the automated specs. DIN-04 automation generates the bill and pays by card. The split-bill scenario stays TC-DIN-004 (manual).

## QSR Prepaid (1)

| ID | Module | Scenario | Preconditions | Steps | Test data | Expected result | Priority | Type | Automation mapping |
|---|---|---|---|---|---|---|---|---|---|
| TC-QSR-001 | QSR Prepaid (1) | Scan QR opens menu | QSR outlet with items | Scan table QR on mobile | QR_QSR | Menu for correct outlet loads | P1 | Positive | qsr-prepaid QSR-01 |
| TC-QSR-002 | QSR Prepaid (1) | Order & pay success | Menu loaded | Add items > Cart > Place order > Pay (success) | PG sandbox success | Order confirmed; token shown; order on merchant panel | P1 | Positive | qsr-prepaid QSR-02 |
| TC-QSR-003 | QSR Prepaid (1) | Payment failure | Menu loaded | Pay with failing instrument | PG sandbox failure | Failure shown; order NOT sent to kitchen; retry offered | P1 | Negative | qsr-prepaid QSR-03 |
| TC-QSR-004 | QSR Prepaid (1) | Payment timeout / pending | Menu loaded | Abandon PG page until timeout | - | Status pending then resolved via callback/status API; no duplicate order | P1 | Edge | qsr-prepaid QSR-04 |
| TC-QSR-005 | QSR Prepaid (1) | Back/close during payment | At PG page | Press back / kill app, reopen | - | Order state consistent; no double charge | P1 | Edge | Manual |
| TC-QSR-006 | QSR Prepaid (1) | Payment success but callback delayed | PG success | Delay webhook | - | Order confirmed after reconciliation; customer sees processing | P1 | Edge | Manual |
| TC-QSR-007 | QSR Prepaid (1) | Double tap Pay | Cart ready | Tap Pay twice quickly | - | Single transaction | P1 | Edge | Manual |
| TC-QSR-008 | QSR Prepaid (1) | Out-of-stock item | Item OOS | Try to add item | MENU_OOS_ITEM | Add disabled; Out of stock label | P1 | Negative | qsr-prepaid QSR-05 |
| TC-QSR-009 | QSR Prepaid (1) | Cart quantity update & totals | Items in cart | Change qty, remove item | - | Subtotal, tax, total recalc correctly | P2 | Positive | Manual |
| TC-QSR-010 | QSR Prepaid (1) | Refund on order rejection | Paid order | Merchant rejects order | - | Refund initiated; customer notified | P2 | Edge | Manual |

## Dine-in (2)

| ID | Module | Scenario | Preconditions | Steps | Test data | Expected result | Priority | Type | Automation mapping |
|---|---|---|---|---|---|---|---|---|---|
| TC-DIN-010 | Dine-in (2) | Scan QR opens menu | Dine-in outlet | Scan table QR on mobile | QR_DINEIN | Menu for the correct outlet loads | P1 | Positive | dine-in DIN-01 |
| TC-DIN-001 | Dine-in (2) | Place first order | Dine-in outlet | Scan > add items > Place order | QR_DINEIN | Order sent to kitchen; no payment required | P1 | Positive | dine-in DIN-02 |
| TC-DIN-002 | Dine-in (2) | Add items to running order | Open order on table | Scan again > add items > Place | - | Items appended to same table bill | P1 | Positive | dine-in DIN-03 |
| TC-DIN-003 | Dine-in (2) | Two customers ordering on same table | Open table | Two phones add items concurrently | - | Both rounds on same bill; no lost items | P1 | Edge | Manual |
| TC-DIN-004 | Dine-in (2) | Split bill and pay | Running bill | View bill > Split 2 > each pays share | 2 payers | Each share correct; bill closes after last payment | P1 | Positive | Manual (DIN-04 pays the full bill by card, it does not split) |
| TC-DIN-005 | Dine-in (2) | Split payment partial failure | Split bill | Payer1 success, payer2 fails | - | Bill remains partially paid; payer2 can retry | P1 | Edge | Manual |
| TC-DIN-006 | Dine-in (2) | Pay full bill | Running bill | View bill > Pay full | - | Bill closed; table freed | P1 | Positive | dine-in DIN-04 |
| TC-DIN-007 | Dine-in (2) | Add items after bill paid | Bill closed | Scan QR and order | - | New session/bill created | P2 | Edge | Manual |
| TC-DIN-008 | Dine-in (2) | Item cancelled by merchant mid-order | Running order | Merchant cancels an item | - | Bill reduced accordingly | P2 | Edge | Manual |
| TC-DIN-009 | Dine-in (2) | Concurrent payment of same bill from 2 phones | Running bill | Both pay full simultaneously | - | Only one succeeds; other refunded/blocked | P1 | Edge | Manual |

## View & Pay Bill (3)

| ID | Module | Scenario | Preconditions | Steps | Test data | Expected result | Priority | Type | Automation mapping |
|---|---|---|---|---|---|---|---|---|---|
| TC-PB-007 | View & Pay Bill (3) | Scan QR opens menu | View-and-pay outlet | Scan table QR on mobile | QR_PAYBILL | Menu or bill entry for the outlet loads | P1 | Positive | view-pay-bill PB-01 |
| TC-PB-001 | View & Pay Bill (3) | View bill and pay | POS bill on table | Scan > View bill > Pay | QR_PAYBILL | Bill amount matches POS; paid status synced | P1 | Positive | view-pay-bill PB-02 |
| TC-PB-002 | View & Pay Bill (3) | Split bill 3 ways | Bill exists | Split 3 > pay | 3 payers | Shares sum to total (rounding handled) | P1 | Positive | view-pay-bill PB-03 |
| TC-PB-003 | View & Pay Bill (3) | Payment failure | Bill exists | Pay with failing instrument | - | Bill remains open | P1 | Negative | view-pay-bill PB-04 |
| TC-PB-004 | View & Pay Bill (3) | No bill on table | No open bill | Scan QR | - | 'No bill yet' message | P2 | Negative | Manual |
| TC-PB-005 | View & Pay Bill (3) | Bill updated while customer viewing | Bill open on phone | Waiter adds item on POS; customer pays | - | Customer sees refreshed amount before paying | P1 | Edge | Manual |
| TC-PB-006 | View & Pay Bill (3) | Tip / service charge | Bill exists | Add tip and pay | Tip 10% | Total includes tip; receipt shows | P3 | Positive | Manual |

## Takeaway (4)

| ID | Module | Scenario | Preconditions | Steps | Test data | Expected result | Priority | Type | Automation mapping |
|---|---|---|---|---|---|---|---|---|---|
| TC-TA-006 | Takeaway (4) | Scan QR opens menu | Takeaway outlet | Scan QR on mobile | QR_TAKEAWAY | Menu for the outlet loads | P1 | Positive | takeaway TA-01 |
| TC-TA-001 | Takeaway (4) | Place takeaway order and pay | Takeaway outlet | Scan > add > place > pay | QR_TAKEAWAY | Order confirmed with pickup token | P1 | Positive | takeaway TA-02 |
| TC-TA-002 | Takeaway (4) | Empty cart checkout | Menu loaded | Open cart with no items | - | Place order disabled | P2 | Negative | takeaway TA-03 |
| TC-TA-003 | Takeaway (4) | Customer contact required | Takeaway | Place without mobile | - | Mobile required for pickup notifications (confirm) | P2 | Negative | Manual |
| TC-TA-004 | Takeaway (4) | Order ready notification | Paid order | Merchant marks ready | - | Customer notified | P2 | Positive | Manual |
| TC-TA-005 | Takeaway (4) | Payment failure on takeaway | Cart ready | Pay with failing instrument | - | Order not created | P1 | Negative | Manual |

## QR Code

| ID | Module | Scenario | Preconditions | Steps | Test data | Expected result | Priority | Type | Automation mapping |
|---|---|---|---|---|---|---|---|---|---|
| TC-QR-001 | QR Code | Expired QR | Expired/revoked QR | Scan | QR_EXPIRED | Friendly 'QR expired/invalid' page | P1 | Negative | invalid-qr QR-01 |
| TC-QR-002 | QR Code | Tampered QR token | Valid QR | Modify token in URL | Token+'tampered' | Error page; no other merchant's menu | P1 | Negative | invalid-qr QR-02 |
| TC-QR-003 | QR Code | QR of deactivated outlet/account | Inactive outlet | Scan | - | Unavailable message | P2 | Negative | Manual |
| TC-QR-004 | QR Code | QR table id enumeration | Valid QR | Change table id param | table+1 | Cannot access other tables' bills (authz) | P1 | Negative | Manual |
| TC-QR-005 | QR Code | Scan with non-Paytm scanner / desktop | Valid QR | Open via camera app & desktop browser | - | Menu works responsively | P3 | Edge | Manual |
