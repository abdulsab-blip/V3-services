import json
import os
from openpyxl import Workbook
from openpyxl.drawing.image import Image as XLImage
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from PIL import Image as PILImage

ROOT = '/Users/sharathsp/Documents/v3-services'
OUT = f'{ROOT}/reports/Dine-in-v3-Java-Migration-Report.xlsx'
SHOT_DIR = f'{ROOT}/reports/screenshots/java'
RUNS = f'{ROOT}/reports/runs'
JAVA = 'dine-in-service-staging.paytmcheckout.com'

HEADER_FILL = PatternFill('solid', fgColor='1F3864')
HEADER_FONT = Font(bold=True, color='FFFFFF')
TITLE_FONT = Font(bold=True, size=14, color='1F3864')
THIN = Side(style='thin', color='BFBFBF')
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
FILLS = {
    'PASS': 'C6EFCE', 'FAIL': 'FFC7CE', 'YES': 'C6EFCE', 'NO': 'FFEB9C', 'MATCH': 'C6EFCE', 'DIFFERENT': 'FFC7CE',
    'HIGH': 'FFC7CE', 'MEDIUM': 'FFEB9C', 'LOW': 'DDEBF7', 'INFO': 'EDEDED', 'NOT TESTED': 'EDEDED', 'N/A': 'EDEDED',
    'CONFIRMED REGRESSION': 'FFC7CE', 'NEEDS DEV CHECK': 'FFEB9C', 'ENVIRONMENT ONLY': 'EDEDED',
}

wb = Workbook()


def sheet(title, headers, rows, widths, status_cols=(), first=False, height=None):
    ws = wb.active if first else wb.create_sheet()
    ws.title = title
    ws.append(headers)
    for c in ws[1]:
        c.fill, c.font, c.border = HEADER_FILL, HEADER_FONT, BORDER
        c.alignment = Alignment(wrap_text=True, vertical='center')
    for r in rows:
        ws.append(r)
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.alignment = Alignment(wrap_text=True, vertical='top')
            c.border = BORDER
            if c.column in status_cols and isinstance(c.value, str):
                key = c.value.upper()
                if key in FILLS:
                    c.fill = PatternFill('solid', fgColor=FILLS[key])
                    c.font = Font(bold=True)
        if height:
            ws.row_dimensions[row[0].row].height = height
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = 'B2'
    ws.auto_filter.ref = ws.dimensions
    return ws


# ---------------------------------------------------------------- Summary
ws = wb.active
ws.title = 'Summary'
lines = [
    ('Dine-in QR (qr_menu_v3) – Ruby → Java API migration: regression report', TITLE_FONT),
    ('Test date: 23 Sep 2026 · Environment: staging · QR code zeFdKxA86l (Kailash Parbat – Pure Veg Restaurant, AED)', None),
    ('', None),
    ('ANSWER: Are all APIs calling the new Java service?', Font(bold=True, size=12)),
    ('YES. Every API call made by https://biz.test.paytmcheckout.com/qr_menu_v3/ goes to https://dine-in-service-staging.paytmcheckout.com. '
     'Zero API calls went to the Ruby host (biz.test) in the recorded runs. The only biz.test requests are page loads (HTML / Next.js page data), which is expected.', None),
    ('How verified: (1) the v3 JavaScript bundle has a single API client whose baseURL is the Java host whenever the URL contains qr_menu_v3 '
     '(biz.test is used only on localhost); (2) every network request was recorded during a full live order + payment and checked host by host.', None),
    ('', None),
    ('BUT the Java APIs are not yet functionally equal to Ruby – issues found:', Font(bold=True, size=12)),
    ('• HIGH – Add-ons are dropped when the order is created (qr_code_order_create). Both flows added exactly the same items (Dahi ke Kebab 23.80; Paneer Dum Biryani 27.00 + Biryani Salan Dip 1.50 + Special Spiced Dates 3.00 = 55.30). '
     'Ruby stores the add-ons; Java does not, so the customer is billed and charged AED 54.80 instead of AED 59.30. Java bills correctly when the order already has add-ons, so the defect is only in order creation. See "Item Details".', None),
    ('• MEDIUM – Payment success screen shows AED 48.38 while AED 54.80 was charged (Java returns net_payable_amount without VAT and tip after payment).', None),
    ('• HIGH – Linked & recommended items missing on v3: Java menu API returns empty linked_item_ids / recommended_item_ids for all 155 items, so "Complete your meal" (bottom sheet on Add) and "Often bought with" (after adding) never appear. Ruby shows both. Injecting Ruby ids into the Java response makes v3 show them → API defect. Cart "Bestseller" (qr_recommended_items) works on both.', None),
    ('• LOW – Cart preview (qr_view_cart) returns base_mrp = 0 for add-ons and omits order_id / uuid.', None),
    ('• Needs dev check – split-bill mode differs (Ruby UI now splits the bill, v3 does not); Java bill lists add-ons as separate lines; "Table already in use" sheet not shown on Java; ₹ / "Table undefined" seen once on a fresh reopen; Ruby cannot read Java-created paid bills; customer_orders accepts pin=null.', None),
    ('• Start a new order – PASS: returns to the menu for the same QR on the Java host, customer prefilled, empty cart, table free.', None),
    ('', None),
    ('Numbers', Font(bold=True, size=12)),
    ('API endpoints in the v3 frontend: 14 · Called in the dine-in card flow: 12 (all on Java host, all 2xx) · Not called in this flow: 2 (qr_view_cart, apple_pay/validate_merchant)', None),
    ('Test cases in this report: see "Functional Test Cases" (API contract, Ruby/Java parity, end-to-end steps incl. Start a new order, item comparison, Ruby baseline)', None),
    ('Ruby baseline (same flow through old /qr_menu/ UI): PASS on every check → failures above are regressions introduced by the Java migration.', None),
    ('', None),
    ('Sheets in this workbook', Font(bold=True, size=12)),
    ('API Inventory – every endpoint, purpose, screen, whether called, host, status, CORS, Ruby parity', None),
    ('Screens & Flow – each screen of the Figma flow, APIs it calls, expected vs actual, screenshot', None),
    ('Functional Test Cases – all automated test cases with result', None),
    ('Not Called - Not Covered – APIs not called and scenarios not tested', None),
    ('Issues – defect list with steps, expected, actual, evidence', None),
    ('Linked & Recommended – Complete your meal / Often bought with / cart Bestseller on Ruby vs Java, with screenshots', None),
    ('Item Details (Java vs Ruby) – same items in both flows, item-by-item at request, stored order, bill and payment, with the mismatch breakdown', None),
    ('Ruby vs Java Diffs – field-level response differences', None),
    ('Environment & How to Run – setup notes and commands', None),
]
for text, font in lines:
    ws.append([text])
    cell = ws.cell(row=ws.max_row, column=1)
    cell.alignment = Alignment(wrap_text=True, vertical='top')
    if font:
        cell.font = font
ws.column_dimensions['A'].width = 160
for r in range(1, ws.max_row + 1):
    ws.row_dimensions[r].height = 32 if len(str(ws.cell(r, 1).value or '')) > 150 else 18

# ---------------------------------------------------------------- API inventory
api_rows = [
    [1, 'POST', '/qr_online_order/{code}', 'Load restaurant, table, menu categories & items (issues QR scan token)', 'Landing / Welcome sheet, Menu, Start a new order; also the data source for "Complete your meal" (linked_item_ids) and "Often bought with" (recommended_item_ids)', 'Yes', JAVA, 3, '200', 'Pass', 'DIFFERENT', 'ISS-04'],
    [2, 'GET', '/qr_online_order/{code}/items/{itemId}/options', 'Customisation options (add-ons, variants) for an item', 'Item customisation sheet', 'Yes', JAVA, 1, '200', 'Pass', 'MATCH', ''],
    [3, 'POST', '/qr_recommended_items/{code}', 'Recommended / bestseller items for the cart', 'Cart – "Bestseller at <restaurant>" section', 'Yes', JAVA, 1, '200', 'Pass', 'MATCH', ''],
    [4, 'GET', '/view_cart/?code={code}', 'Table session state (free / PIN required / OTP)', 'Send Order To Kitchen, Pay bill (guest), precondition', 'Yes', JAVA, 3, '200', 'Pass', 'MATCH', ''],
    [5, 'POST', '/qr_code_order_create/{code}', 'Create the order with items + add-ons + customer name/mobile', 'Place your order (swipe to send to kitchen)', 'Yes', JAVA, 1, '200', 'Pass', 'Not compared (creates order) – Ruby baseline keeps add-ons', 'ISS-01, ISS-02'],
    [6, 'GET', '/customer_orders/{code}?pin={pin}', 'Current table order / join table with PIN', 'Order in kitchen, Join table (guest)', 'Yes', JAVA, 4, '200', 'Pass', 'Not compared (session data)', 'ISS-09'],
    [7, 'GET', '/qr_print/{code}.json?view=customer[&pay_now=true|&ct=]', 'Bill before payment / receipt after payment', 'Pay bill, Payment success', 'Yes', JAVA, 3, '200', 'Pass', 'Could not compare (Ruby errors on Java token)', 'ISS-02, ISS-03, ISS-08'],
    [8, 'POST', '/initiate_payment/{code}?tip={tip}', 'Start payment, returns Telr payment URL', 'Select payment method (card)', 'Yes', JAVA, 1, '200', 'Pass', 'Not compared (creates payment)', ''],
    [9, 'POST', '/api/http_logs.json', 'Client-side payment event logging', 'Payment method, payment return', 'Yes', JAVA, 5, '201', 'Pass', 'N/A', ''],
    [10, 'POST', '/qr_orders/add_tip/{code}?ct=&status=', 'Save tip after payment return', 'Payment success', 'Yes', JAVA, 2, '204', 'Pass', 'Not compared (mutating)', ''],
    [11, 'GET', '/fetch_payment_status_by_session_id/{code}?ct=', 'Poll payment status until terminal', 'Payment processing / success', 'Yes', JAVA, 3, '200', 'Pass', 'Not compared (session)', ''],
    [12, 'POST', '/post_order_feedback/{code}', 'Submit star rating + feedback tags', 'Rating & feedback sheet', 'Yes', JAVA, 1, '200', 'Pass', 'Not compared (mutating)', ''],
    [13, 'POST', '/qr_view_cart/{code}(.json?view=customer)', 'Cart price preview / bill preview (offers, QSR, split bill modes)', 'Not used in this dine-in card flow', 'No', 'Java (by code); tested directly by API test', 0, '200 (API test)', 'Pass', 'DIFFERENT', 'ISS-05'],
    [14, 'POST', '/apple_pay/validate_merchant', 'Apple Pay merchant validation', 'Apple Pay (iOS Safari only)', 'No', 'Java (by code)', 0, 'Not called', 'Pass', 'Not compared', ''],
]
sheet('API Inventory',
      ['#', 'Method', 'Endpoint', 'Purpose', 'Screen / trigger', 'Called in flow?', 'Host observed', 'Calls in run', 'HTTP status', 'CORS preflight', 'Ruby vs Java response', 'Issue ref'],
      api_rows, [4, 8, 44, 44, 34, 10, 38, 9, 12, 11, 30, 14], status_cols=(6, 10, 11))

# ---------------------------------------------------------------- Screens
screens = [
    [1, 'Welcome sheet ("You are on table Dine In")', 'Open QR link', 'POST qr_online_order', 'Restaurant name, logo, Start Your Order / Pay your bill', 'As expected', 'PASS', '01-welcome'],
    [2, 'Menu / catalogue', 'Tap Start Your Order; open "Offers" tab', '— (menu data from step 1)', 'Search, VEG mode, category tabs, items with prices', 'As expected', 'PASS', None],
    [3, 'Add simple item', 'Tap Add on Dahi ke Kebab', 'None (cart is client-side)', '"1 items added" bar', 'As expected', 'PASS', '02-simple-item-added'],
    [4, 'Item customisation sheet', 'Tap Add on Paneer Dum Biryani, tick Biryani Salan Dip + Special Spiced Dates, Add item', 'GET items/{id}/options', 'Add-ons listed with prices, "2 items added"', 'As expected', 'PASS', '03-customised-item-added'],
    [5, 'Cart', 'Tap View', 'POST qr_recommended_items', 'Both items, add-ons listed, total AED 55.30', 'As expected (AED 55.30)', 'PASS', '04-cart'],
    [6, 'Place your order (name + phone)', 'Send Order To Kitchen, enter name & +971 mobile, swipe', 'GET view_cart, POST qr_code_order_create, GET customer_orders', 'Order created with both items AND add-ons', 'Order created but add-ons missing (customizations = [])', 'FAIL', None],
    [7, 'Order in kitchen (PIN shown)', '—', 'GET customer_orders', '"Your order is in the kitchen", PIN = last 4 digits of mobile', 'As expected (PIN 4567); add-ons not shown under item', 'FAIL', '05-order-in-kitchen'],
    [8, 'Second guest: Join table with PIN', 'New phone opens QR → Pay bill → enter PIN → Join Table', 'POST qr_online_order, GET view_cart, GET customer_orders?pin=', 'Guest sees the same order', 'As expected', 'PASS', '06-guest-joined'],
    [9, 'Pay bill (bill screen)', 'Generate bill', 'GET qr_print?pay_now=true', 'Item total incl. add-ons, VAT, tip AED 4, total AED 59.30', 'Total AED 54.80 (add-ons AED 4.50 missing)', 'FAIL', '07-bill'],
    [10, 'Select payment method → card form', 'Change → Debit/Credit Cards', 'POST initiate_payment?tip=4, POST http_logs', 'Telr card form, Pay AED 59.30', 'Telr form shown, Pay AED 54.80', 'FAIL', '08-card-form'],
    [11, 'Telr payment (3rd party)', 'Card 4000 0000 0000 0002, 06/28, CVV 123, Pay', 'secure.telr.com (payment gateway, not ours)', 'Payment authorised, redirect back', 'status=authorised, redirected', 'PASS', None],
    [12, 'Payment success', '—', 'POST add_tip, GET fetch_payment_status (poll), GET qr_print?ct, POST http_logs', '"Paid successfully" with amount charged (AED 54.80)', 'Shows AED 48.38', 'FAIL', '09-paid'],
    [13, 'Re-open payment return link', 'Reload the from_pg link', 'POST add_tip (again), GET qr_print', 'Tip stays AED 4 (not doubled), AED currency', 'Tip stays 4.0, AED shown', 'PASS', '10-paid-after-reload'],
    [14, 'Rating & feedback', '5 stars → Food, Prompt Service → Submit', 'POST post_order_feedback', 'rating 5, tags "food, prompt_service", status success', 'As expected', 'PASS', '11-feedback-submitted'],
    [15, 'Table released', '—', 'GET view_cart', 'next_step = customer_details (table free)', 'As expected', 'PASS', None],
    [16, 'Start a new order', 'Tap "Start a new order" on the success screen, then add Dahi ke Kebab',
     'POST qr_online_order (sends saved user_name + mobile), GET view_cart',
     'Back to menu for same QR, empty cart, customer details prefilled, no active order, table still free',
     'Menu reloaded on Java host with name/mobile prefilled; active_orders = false; cart empty; new item shows "1 items added"; table free. Welcome sheet skipped (same as Ruby)', 'PASS', '12-start-new-order'],
    [17, 'Soups & Snacks → Add → "Complete your meal" sheet (linked items)', 'Tap Add on Onion Samosa',
     'None (uses linked_item_ids from POST qr_online_order)', 'Bottom sheet with linked items 7 UP (10.00) and Pepsi (4.50); linked item can be added with the item',
     'Java: no sheet, Onion Samosa added directly (linked_item_ids empty). Ruby: sheet shown with 7 UP, Pepsi', 'FAIL', 'live-1-add-onion-samosa'],
    [18, '"Often bought with" section (recommended items)', 'After adding Onion Samosa',
     'None (uses recommended_item_ids from POST qr_online_order)', 'Carousel under the item: Gulab Jamun, 7 UP, Pepsi',
     'Java: section not shown (recommended_item_ids empty). Ruby: shown', 'FAIL', 'live-2-often-bought-with'],
    [19, 'Cart "Bestseller at Kailash Parbat" (recommended items)', 'Open cart',
     'POST qr_recommended_items', 'Bestseller carousel with recommended items', 'Shown on Java and Ruby (Gulab Jamun, 7 UP / Double ka meetha, Pepsi – depends on cart)', 'PASS', 'live-4-cart-bestseller'],
]
ws = sheet('Screens & Flow',
           ['#', 'Screen', 'User action', 'APIs called (all on Java host)', 'Expected', 'Actual (Java)', 'Result', 'Screenshot'],
           [s[:7] + [''] for s in screens], [4, 30, 38, 40, 40, 36, 9, 30], status_cols=(7,))
os.makedirs('/tmp/rpt_thumbs', exist_ok=True)
for i, s in enumerate(screens, start=2):
    key = s[7]
    if not key:
        ws.cell(i, 8).value = '—'
        continue
    src = f'{SHOT_DIR}/{key}.png'
    thumb = f'/tmp/rpt_thumbs/{key}.png'
    im = PILImage.open(src)
    im.thumbnail((190, 330))
    im.save(thumb)
    ws.row_dimensions[i].height = im.height * 0.75 + 6
    ws.add_image(XLImage(thumb), f'H{i}')

# ---------------------------------------------------------------- Test cases
tc = []
cors = ['qr_online_order', 'items/{id}/options', 'qr_recommended_items', 'view_cart', 'qr_view_cart', 'qr_code_order_create', 'customer_orders',
        'qr_print', 'initiate_payment', 'apple_pay/validate_merchant', 'qr_orders/add_tip', 'fetch_payment_status_by_session_id', 'post_order_feedback', 'api/http_logs']
for n, e in enumerate(cors, 1):
    tc.append([f'API-{n:02d}', 'API contract (Java)', f'CORS preflight allows web app for {e}', 'OPTIONS from origin biz.test', 'Allow-Origin = biz.test, credentials true, method + content-type/session-token allowed', 'As expected', 'PASS', ''])
tc += [
    ['API-15', 'API contract (Java)', 'Menu returns restaurant, AED currency, categories', 'POST qr_online_order', '200, account, AED, categories, numeric prices', 'As expected (≈0.6 s)', 'PASS', ''],
    ['API-16', 'API contract (Java)', 'Cart preview prices items together with add-ons', 'POST qr_view_cart with 2 items + 2 add-ons', 'net_payable_amount = 55.30, 2 add-on lines', 'As expected', 'PASS', ''],
    ['API-17', 'API contract (Java)', 'Recommended items for cart items', 'POST qr_recommended_items', '200, add_on_items.items array', 'As expected', 'PASS', ''],
    ['API-18', 'API contract (Java)', 'Table session state reported', 'GET view_cart', 'next_step customer_details / verify_otp', 'As expected', 'PASS', ''],
    ['API-19', 'API contract (Java)', 'Invalid QR code rejected', 'POST qr_online_order/INVALID123', '422 "Invalid QR Code"', 'As expected', 'PASS', ''],
    ['API-20', 'API contract (Java)', 'Unknown item options rejected', 'GET items/999999/options', '422 "Item not found"', 'As expected', 'PASS', ''],
    ['PAR-01', 'Ruby vs Java parity', 'Menu response identical', 'Same request to both hosts', 'No field differences', '338 differences (recommended_item_ids, linked_item_ids, multilingual_enabled)', 'FAIL', 'ISS-04'],
    ['PAR-02', 'Ruby vs Java parity', 'Item options identical', 'Same request to both hosts', 'No differences', '0 differences (261 fields)', 'PASS', ''],
    ['PAR-03', 'Ruby vs Java parity', 'Recommended items identical', 'Same request to both hosts', 'No differences', '0 differences', 'PASS', ''],
    ['PAR-04', 'Ruby vs Java parity', 'Table session state identical', 'Same request to both hosts', 'No differences', '0 differences', 'PASS', ''],
    ['PAR-05', 'Ruby vs Java parity', 'Cart preview with add-ons identical', 'Same request to both hosts', 'No differences (temporary ids ignored)', 'base_mrp 0 vs 1.5/3, offer_amount 0 vs null, notes null vs "", order_id & uuid missing', 'FAIL', 'ISS-05'],
    ['PAR-06', 'Ruby vs Java parity', 'Invalid QR error identical', 'Same request to both hosts', 'Same status & message', '422 "Invalid QR Code" on both', 'PASS', ''],
    ['E2E-01', 'End-to-end (Java)', 'Precondition: table free / auto-settle open table', 'view_cart; if busy join with PIN and pay', 'Table free before run', 'As expected (auto-settle also verified)', 'PASS', ''],
    ['E2E-02', 'End-to-end (Java)', 'Welcome sheet and menu load', 'Open QR link', 'Welcome sheet, menu, AED', 'As expected', 'PASS', ''],
    ['E2E-03', 'End-to-end (Java)', 'Add simple item', 'Offers tab → Add Dahi ke Kebab', '"1 items added"', 'As expected', 'PASS', ''],
    ['E2E-04', 'End-to-end (Java)', 'Add customisable item with 2 add-ons', 'Paneer Dum Biryani + 2 add-ons', '"2 items added"', 'As expected', 'PASS', ''],
    ['E2E-05', 'End-to-end (Java)', 'Cart shows items, add-ons, total', 'View cart', 'AED 55.30 (= menu + option prices)', 'As expected', 'PASS', ''],
    ['E2E-06', 'End-to-end (Java)', 'Order creation keeps add-ons', 'Name, mobile, swipe', 'Add-ons present on created order', 'customizations = [] → add-ons lost', 'FAIL', 'ISS-01'],
    ['E2E-07', 'End-to-end (Java)', 'Second guest joins with PIN', 'New browser → Pay bill → PIN 4567', 'Guest sees the order', 'As expected', 'PASS', ''],
    ['E2E-08', 'End-to-end (Java)', 'Bill equals cart total + tip', 'Generate bill', 'Bill 55.30, total with tip 59.30', 'Bill 50.80, total 54.80', 'FAIL', 'ISS-02'],
    ['E2E-09', 'End-to-end (Java)', 'Card payment opens Telr with correct amount', 'Change → Debit/Credit Cards', 'initiate_payment tip=4, Telr "Pay AED 59.30"', 'tip=4 correct, Telr shows AED 54.80', 'FAIL', 'ISS-02'],
    ['E2E-10', 'End-to-end (Java)', 'Pay with test card, payment success', 'Card 4000…0002, 06/28, 123', 'authorised → payment_success, tip saved', 'As expected', 'PASS', ''],
    ['E2E-11', 'End-to-end (Java)', 'Success screen shows amount charged', 'Read "Paid successfully" amount', 'AED 54.80 (charged)', 'AED 48.38', 'FAIL', 'ISS-03'],
    ['E2E-12', 'End-to-end (Java)', 'Re-open return link does not double the tip', 'Reload from_pg link', 'Tip remains 4.0; AED; table name shown', 'As expected', 'PASS', ''],
    ['E2E-13', 'End-to-end (Java)', 'Rating & feedback submitted', '5 stars + 2 tags + Submit', 'status success, rating 5, correct tags', 'As expected', 'PASS', ''],
    ['E2E-14', 'End-to-end (Java)', 'Table released after payment', 'view_cart', 'customer_details', 'As expected', 'PASS', ''],
    ['E2E-15', 'End-to-end (Java)', 'All API calls go to Java host', 'Network recorder on every page', '0 calls off dine-in-service-staging', '0 calls off host (12 endpoints, ~27 calls)', 'PASS', ''],
    ['E2E-16', 'End-to-end (Java)', 'No API call fails', 'Network recorder', 'No 4xx/5xx/network errors', 'None', 'PASS', ''],
    ['E2E-17', 'End-to-end (Java)', 'Every flow endpoint was exercised', 'Compare with expected list of 12', 'All 12 called', 'All 12 called', 'PASS', ''],
    ['E2E-18', 'End-to-end (Java)', 'Start a new order after payment', 'Tap "Start a new order", add an item', 'Menu for same QR, empty cart, customer prefilled, table free', 'As expected (menu call on Java host, active_orders false, "1 items added")', 'PASS', ''],
    ['ITEM-01', 'Item comparison', 'Same items added in Java and Ruby flows', 'Compare order request lines of both runs', 'Identical item ids, quantities, unit prices, add-ons', 'Identical: Dahi ke Kebab 23.80; Paneer Dum Biryani 27.00 + Biryani Salan Dip 1.50 + Special Spiced Dates 3.00 = 55.30', 'PASS', 'See "Item Details"'],
    ['ITEM-02', 'Item comparison', 'Stored order keeps add-ons', 'order_create response per item', 'Paneer Dum Biryani stored with 2 add-ons', 'Ruby: 2 add-ons, line 30.00 ex VAT · Java: none, line 25.71 ex VAT', 'FAIL', 'ISS-01'],
    ['ITEM-03', 'Item comparison', 'Bill lines include add-ons', 'qr_print (bill) per item', 'Add-ons shown on bill, VAT on add-ons included', 'Ruby: add-ons listed, VAT 2.63 · Java: none, VAT 2.42', 'FAIL', 'ISS-01'],
    ['ITEM-04', 'Item comparison', 'Java bills a Ruby-created order with add-ons correctly', 'Create order via Ruby, pay it via Java UI (settle tool)', 'Bill 55.30, Telr charge 59.30', 'Bill 55.30, Telr "Pay AED 59.30" → Java billing/payment is correct; defect is only in Java order creation', 'PASS', 'ISS-01, ISS-11'],
    ['LR-01', 'Linked & recommended', '"Complete your meal" bottom sheet opens on Add (Soups & Snacks)', 'Tap Add on Onion Samosa', 'Sheet with linked items 7 UP, Pepsi', 'Java: no sheet · Ruby: shown', 'FAIL', 'ISS-04'],
    ['LR-02', 'Linked & recommended', 'Linked item can be added from "Complete your meal"', 'Aloo & Cheese Samosa → select 7 UP → Add item', 'Cart has the item + 7 UP', 'Java: not possible (no sheet) · Ruby: cart = Onion Samosa, Aloo & Cheese Samosa, 7 UP', 'FAIL', 'ISS-04'],
    ['LR-03', 'Linked & recommended', '"Often bought with" shown after adding item', 'Add Onion Samosa', 'Gulab Jamun, 7 UP, Pepsi', 'Java: not shown · Ruby: shown', 'FAIL', 'ISS-04'],
    ['LR-04', 'Linked & recommended', 'Cart "Bestseller" shows recommended items', 'Open cart', 'Items from qr_recommended_items', 'Shown on Java and Ruby', 'PASS', ''],
    ['LR-05', 'Linked & recommended', 'Root cause diagnostic: v3 UI with Ruby ids injected into Java menu response', 'Intercept Java qr_online_order, copy linked/recommended ids from Ruby', 'If sections appear, v3 frontend is fine and the Java API is the cause', 'All sections appear and work in v3 → Java API defect', 'PASS', 'ISS-04'],
    ['LR-06', 'Linked & recommended', 'Menu data: linked / recommended ids present', 'Compare Ruby vs Java qr_online_order', '14 items with linked ids, 83 with recommended ids', 'Java: 0 and 0 (all 155 items empty)', 'FAIL', 'ISS-04'],
    ['BASE-03', 'Ruby baseline', 'Ruby baseline full flow (16:38)', 'npm run test:ruby-baseline', 'Same flow as Java incl. payment and feedback', 'Passed all order/bill/payment checks: add-ons stored, bill 55.30, charged 59.30, success screen 59.30, tip 4 saved. Last step differs: Ruby success page shows "Back to food court menu" instead of "Start a new order" (old UI build)', 'PASS', 'Control for ISS-01..03'],
    ['BASE-02', 'Ruby baseline', 'Re-run of Ruby baseline (16:10)', 'npm run test:ruby-baseline', 'Full bill with tip, card payment', 'Old /qr_menu/ UI opened the bill in split-bill mode ("This bill is split", "Proceed to your share") even with one payer; no tip shown. Intermittent: the 16:38 run showed the full bill', 'NOT TESTED', 'ISS-10'],
    ['BASE-01', 'Ruby baseline', 'Same end-to-end flow via old /qr_menu/ (Ruby APIs)', 'npm run test:ruby-baseline', 'All checks pass', 'All checks pass (add-ons kept, amounts correct)', 'PASS', 'Control for ISS-01..03'],
]
sheet('Functional Test Cases', ['ID', 'Area', 'Test case', 'Steps / input', 'Expected', 'Actual', 'Result', 'Issue ref'],
      tc, [9, 20, 44, 36, 42, 44, 9, 16], status_cols=(7,))

# ---------------------------------------------------------------- Not called / not covered
nc = [
    ['API not called in flow', 'POST /qr_view_cart/{code}', 'Used only for offers / QSR / split-bill bill preview, not in the dine-in card flow', 'Covered by API tests (contract + parity) – found ISS-05', 'Covered by API test'],
    ['API not called in flow', 'POST /apple_pay/validate_merchant', 'Apple Pay works only in iOS Safari with a real Apple Pay wallet', 'CORS verified only; needs manual test on iPhone', 'NOT TESTED'],
    ['Scenario not covered', 'Samsung Pay payment', 'Default method on the bill screen; needs Samsung device/wallet', 'Manual test on Samsung device', 'NOT TESTED'],
    ['Scenario not covered', 'Apple Pay payment', 'Needs iPhone + Apple Pay', 'Manual test on iPhone', 'NOT TESTED'],
    ['Scenario not covered', 'Failed / declined card payment', 'Needs a Telr test card that declines', 'Share a decline test card to add this case', 'NOT TESTED'],
    ['Scenario not covered', 'Offers / coupons (apply offer)', 'No offer applied in flow; uses qr_view_cart with offer_id', 'Add test with a merchant offer', 'NOT TESTED'],
    ['Scenario not covered', 'Split bill (pay your share)', 'allow_split_bill = true; old Ruby UI now opens split mode, v3 UI does not (ISS-10); paying a share not tested', 'Confirm expected v3 behaviour, then add test', 'NOT TESTED'],
    ['Scenario not covered', 'Add more items after order (second round)', 'Button exists on order and bill screens', 'Add test', 'NOT TESTED'],
    ['Scenario not covered', 'Item instructions / note for restaurant', 'Edit & add instructions, Add a note', 'Add test', 'NOT TESTED'],
    ['Scenario not covered', 'Combo items, variants, custom tip, tip change (AED 3/5)', 'Only default tip AED 4 and add-ons tested', 'Add tests', 'NOT TESTED'],
    ['Scenario not covered', 'Search and VEG mode', 'UI-only filters on menu data', 'Add tests', 'NOT TESTED'],
    ['Scenario not covered', 'OTP verification flow', 'This merchant has skip_otp = true', 'Test on a merchant with OTP enabled', 'NOT TESTED'],
    ['Scenario not covered', 'Wrong PIN when joining table', 'Only correct PIN tested', 'Add negative test', 'NOT TESTED'],
    ['Reference not fully read', 'Figma flow (20 frames)', 'Figma MCP limit for View seat stopped after 5 frames', 'Flow mapped from the live app instead (15 screens above)', 'N/A'],
]
sheet('Not Called - Not Covered', ['Type', 'Item', 'Reason', 'Recommendation', 'Status'], nc, [24, 42, 60, 48, 16], status_cols=(5,))

# ---------------------------------------------------------------- Issues
issues = [
    ['ISS-01', 'HIGH', 'CONFIRMED REGRESSION', 'Add-ons dropped when order is created', 'POST /qr_code_order_create/{code}',
     '1. Open qr_menu_v3 QR  2. Add Paneer Dum Biryani with Biryani Salan Dip (1.50) + Special Spiced Dates (3.00)  3. Send order to kitchen',
     'Order saved with both add-ons (Ruby: stored line 30.00 ex VAT, customization_names "Biryani Salan Dip, Special Spiced Dates")',
     'Identical request (same 2 customizations) → Java stores Paneer Dum Biryani with customizations = [], line 25.71 ex VAT. '
     'Isolated to order creation: Java customer_orders / qr_print / initiate_payment handle add-ons correctly for a Ruby-created order (bill 55.30, charged 59.30)',
     'Kitchen does not receive add-ons; revenue loss AED 4.50 (+0.21 VAT) on this order', 'E2E-06, ITEM-01..04, sheet "Item Details"'],
    ['ISS-02', 'HIGH', 'CONFIRMED REGRESSION', 'Bill and card charge exclude add-on prices (result of ISS-01)', 'GET /qr_print (pay_now=true), POST /initiate_payment',
     'Continue ISS-01 → Generate bill → Debit/Credit Cards',
     'Bill total 55.30 + tip 4 = AED 59.30 charged', 'Bill net_payable_amount 50.80, "Your total bill" AED 54.80, Telr charged AED 54.80',
     'Customer undercharged; merchant revenue loss', 'E2E-08, E2E-09'],
    ['ISS-03', 'MEDIUM', 'CONFIRMED REGRESSION', 'Payment success screen shows wrong amount', 'GET /qr_print?ct= (after payment)',
     'Pay any bill by card and land on "Paid successfully"',
     'Shows amount charged (AED 54.80). Ruby baseline shows correct amount',
     'Shows AED 48.38 and "Total amount AED 48.38". After payment Java returns net_payable_amount = 48.38 (items without VAT and tip); original_net_amount = 54.80',
     'Customer sees a different amount from what the bank charged', 'E2E-11'],
    ['ISS-04', 'HIGH', 'CONFIRMED REGRESSION', 'Linked items ("Complete your meal") and recommended items ("Often bought with") missing on v3', 'POST /qr_online_order/{code} – linked_item_ids, recommended_item_ids',
     '1. Open qr_menu_v3 QR  2. Soups & Snacks → Add on Onion Samosa  3. Look for "Complete your meal" sheet and "Often bought with" section',
     'Ruby: sheet with 7 UP (10.00), Pepsi (4.50) opens on Add; after adding, "Often bought with" shows Gulab Jamun, 7 UP, Pepsi. Ruby menu has linked ids on 14 items, recommended ids on 83 items',
     'Java menu returns linked_item_ids = [] and recommended_item_ids = [] for all 155 items (also multilingual_enabled missing) → no sheet, item added directly, no "Often bought with". '
     'Diagnostic: injecting Ruby ids into the Java response makes v3 show both sections correctly → Java API defect, not frontend',
     'Upsell / cross-sell of drinks and desserts lost on every item that has linked or recommended items', 'LR-01..06, PAR-01, sheet "Linked & Recommended"'],
    ['ISS-05', 'LOW', 'CONFIRMED REGRESSION', 'Cart preview: add-on base_mrp = 0 and missing fields', 'POST /qr_view_cart/{code}',
     'Call cart preview with 2 items + 2 add-ons on both hosts',
     'Add-on base_mrp 1.5 / 3; offer_amount null; notes ""; order_id and uuid present (null)',
     'Add-on base_mrp 0; offer_amount 0; notes null; order_id and uuid missing. Totals match (55.30)',
     'Wrong MRP / strike-through price for add-ons where shown; clients reading order_id/uuid may break', 'PAR-05'],
    ['ISS-06', 'MEDIUM', 'NEEDS DEV CHECK', '"Table already in use" sheet not shown on Java', 'POST /qr_online_order/{code} (session fields)',
     'With an open table session, open the QR on a new phone',
     'Ruby UI shows "Table already in use – ask staff" sheet', 'Java UI goes straight to the menu (only "View Orders and Pay Bill now" banner)',
     'Guests at a wrong table are not warned', 'Observed in Ruby baseline vs Java runs'],
    ['ISS-07', 'LOW', 'NEEDS DEV CHECK', 'Success page opened fresh shows ₹, "Table undefined", "Restaurant"', 'GET /qr_print?ct= + frontend',
     'Open the payment return link in a new browser (no stored data)', 'AED, table name and restaurant name',
     'Rupee symbol, "Bill for Table undefined", "How was your experience with Restaurant?" (seen once in exploration; not reproduced in automated run)',
     'Wrong currency shown to customer', 'Observed once during exploration; not reproduced in automated runs (no screenshot kept)'],
    ['ISS-08', 'INFO', 'NEEDS DEV CHECK', 'Ruby cannot read paid bill created through Java', 'GET /qr_print?ct= on Ruby',
     'Call Ruby qr_print with the ct token of a Java-paid session', 'Same receipt as Java', '{"errors":{"base":["undefined method \'[]\' for nil"]}}',
     'If both stacks run in parallel during rollout, Ruby screens may fail for Java-created sessions', 'Manual API check'],
    ['ISS-09', 'INFO', 'NEEDS DEV CHECK', 'customer_orders returns the order with pin=null', 'GET /customer_orders/{code}?pin=null',
     'After joining with PIN the app calls customer_orders?pin=null', 'Confirm access is controlled by session token, same as Ruby',
     '200 with full order details', 'Possible access-control gap – security review', 'Network log'],
    ['ISS-10', 'MEDIUM', 'NEEDS DEV CHECK', 'Split-bill behaviour differs between old (Ruby) and new (Java) UI', 'qr_print / split bill (allow_split_bill = true)',
     'Place an order through /qr_menu/ (Ruby) and tap Generate bill; compare with /qr_menu_v3/',
     'Same bill experience on both UIs', 'Ruby UI (16:10 runs): "This bill is split", "Split this bill equally between 2", no tip, "Proceed to your share". '
     'Java v3 UI: full bill with tip and payment method. Earlier Ruby run (13:4x) showed the full bill, so the Ruby UI or merchant setting may have changed today',
     'Customers may see a different payment flow after migration; confirm whether split bill must be supported on v3', 'BASE-02 (split-bill screenshot attached)'],
    ['ISS-11', 'LOW', 'NEEDS DEV CHECK', 'Java bill lists add-ons as separate lines', 'GET /qr_print/{code} (pay_now=true)',
     'Create an order with add-ons via Ruby, open the bill through the Java UI',
     'Ruby bill: 2 lines, add-ons nested ("Biryani Salan Dip, Special Spiced Dates" under Paneer Dum Biryani), total_items 2',
     'Java bill: 4 lines (add-ons as own items 1.50 and 3.00), total_items 4. Totals correct (55.30)',
     'Bill layout / item count differs from Ruby', 'ITEM-04 (settle tool output)'],
    ['ENV-01', 'INFO', 'ENVIRONMENT ONLY', 'Chrome blocks Java API calls on VPN (Local Network Access)', 'All (cross-origin)',
     'Open qr_menu_v3 in Chrome on VPN', 'Menu loads',
     'Intermittent "This QR doesn\'t seem to work": staging host resolves to a private IP, Chrome blocks biz.test → dine-in-service',
     'Testers on VPN only; real customers not affected. Suite disables this Chrome check', 'Browser console'],
]
sheet('Issues', ['ID', 'Severity', 'Classification', 'Title', 'API / area', 'Steps to reproduce', 'Expected (Ruby / correct)', 'Actual (Java)', 'Impact', 'Evidence'],
      issues, [8, 10, 22, 36, 30, 44, 40, 48, 36, 22], status_cols=(2, 3))

# ---------------------------------------------------------------- Linked & recommended
lr_java = json.load(open(f'{RUNS}/java-linked-recommended.json'))
lr_ruby = json.load(open(f'{RUNS}/ruby-linked-recommended.json'))
jl, jd, rl = lr_java['live'], lr_java['diagnostic'], lr_ruby['live']
fmt = lambda v: ', '.join(v) if isinstance(v, list) else ('Yes' if v is True else 'No' if v is False else str(v))
lr_rows = [
    ['"Complete your meal" bottom sheet on Add', 'Onion Samosa (Soups & Snacks)', 'linked_item_ids in POST qr_online_order', fmt(rl['complete_your_meal_shown']), fmt(jl['complete_your_meal_shown']), fmt(jd['complete_your_meal_shown']), 'FAIL', 'live-1-add-onion-samosa'],
    ['Linked items listed in the sheet', 'Onion Samosa', 'linked_item_ids → ' + fmt(rl['expected_linked']), fmt(rl['linked_shown']) or 'none', fmt(jl['linked_shown']) or 'none', fmt(jd['linked_shown']) or 'none', 'FAIL', None],
    ['Add a linked item from the sheet', 'Aloo & Cheese Samosa (Veg) + 7 UP', 'linked_item_ids', fmt(rl['cart_items_shown']), fmt(jl['cart_items_shown']), fmt(jd['cart_items_shown']), 'FAIL', 'live-3-linked-item-selected'],
    ['"Often bought with" section after adding', 'Onion Samosa', 'recommended_item_ids in POST qr_online_order', fmt(rl['often_bought_with_shown']), fmt(jl['often_bought_with_shown']), fmt(jd['often_bought_with_shown']), 'FAIL', 'live-2-often-bought-with'],
    ['Recommended items listed', 'Onion Samosa', 'recommended_item_ids → ' + fmt(rl['expected_recommended']), fmt(rl['recommended_shown']) or 'none', fmt(jl['recommended_shown']) or 'none', fmt(jd['recommended_shown']) or 'none', 'FAIL', None],
    ['Cart "' + rl['bestseller_title'] + '"', 'Cart', 'POST qr_recommended_items (add_on_items)', fmt(rl['bestseller_shown']), fmt(jl['bestseller_shown']), fmt(jd['bestseller_shown']), 'PASS', 'live-4-cart-bestseller'],
]
ws = sheet('Linked & Recommended',
           ['Feature', 'Item / where', 'Data source', 'Ruby UI (old APIs)', 'Java UI – live', 'Java UI – Ruby ids injected (diagnostic)', 'Java result', 'Ruby screenshot', 'Java screenshot'],
           [r[:7] + ['', ''] for r in lr_rows], [34, 26, 34, 34, 30, 34, 10, 30, 30], status_cols=(7,))
for i, r in enumerate(lr_rows, start=2):
    if not r[7]:
        continue
    height = 0
    for col, folder in (('H', 'ruby'), ('I', 'java')):
        src = f'{ROOT}/reports/screenshots/{folder}/{r[7]}.png'
        if not os.path.exists(src):
            src = f'{ROOT}/reports/screenshots/{folder}/diagnostic-3-linked-item-selected.png' if folder == 'java' and '3-linked' in r[7] else None
        if not src:
            ws[f'{col}{i}'] = 'not applicable (no sheet on Java)'
            continue
        thumb = f'/tmp/rpt_thumbs/lr-{folder}-{r[7]}.png'
        im = PILImage.open(src)
        im.thumbnail((190, 330))
        im.save(thumb)
        height = max(height, im.height * 0.75 + 6)
        ws.add_image(XLImage(thumb), f'{col}{i}')
    if height:
        ws.row_dimensions[i].height = height
ws.append([])
ws.append(['Conclusion: Java menu API returns empty linked_item_ids / recommended_item_ids. With Ruby ids injected, the v3 UI shows and handles both sections exactly like Ruby, so the fix is in the Java API (qr_online_order). Java screenshot for "Add a linked item" is from the diagnostic run (not possible live).'])
ws.cell(ws.max_row, 1).font = Font(bold=True)

# ---------------------------------------------------------------- Item details (Java vs Ruby)
java = json.load(open(f'{RUNS}/java-order-details.json'))
ruby = json.load(open(f'{RUNS}/ruby-order-details.json'))
settled = json.load(open(f'{RUNS}/java-settles-ruby-order.json'))


def by_name(rows, key='name'):
    return {r[key]: r for r in rows}


def addons_text(addons):
    return ', '.join(f"{a['name']} @ {a['price']:.2f}" for a in addons) or '—'


def money(v):
    return '—' if v is None or v != v else f'{float(v):.2f}'


item_rows = []


def add(section, item, detail, j, r, note=''):
    j, r = str(j), str(r)
    item_rows.append([section, item, detail, j, r, 'MATCH' if j == r else 'DIFFERENT', note])


jr, rr = by_name(java['requested']), by_name(ruby['requested'])
for name in rr:
    a, b = jr.get(name, {}), rr[name]
    add('1. Items added (order request)', name, 'Item id', a.get('item_id'), b['item_id'])
    add('1. Items added (order request)', name, 'Quantity', a.get('quantity'), b['quantity'])
    add('1. Items added (order request)', name, 'Unit price (menu, incl. VAT)', money(a.get('unit_price')), money(b['unit_price']))
    add('1. Items added (order request)', name, 'Add-ons sent', addons_text(a.get('add_ons', [])), addons_text(b['add_ons']))
    add('1. Items added (order request)', name, 'Line total (item + add-ons)', money(a.get('line_total')), money(b['line_total']))
add('1. Items added (order request)', 'All items', 'Cart total', money(java['requested_total']), money(ruby['requested_total']), 'Same items in both flows')

jc, rc = by_name(java['created']), by_name(ruby['created'])
for name in rc:
    a, b = jc.get(name, {}), rc[name]
    add('2. Stored order (qr_code_order_create response)', name, 'Add-ons stored', ', '.join(a.get('add_ons') or []) or '—', ', '.join(b['add_ons'] or []) or '—',
        'Java drops add-ons' if (b['add_ons'] and not a.get('add_ons')) else '')
    add('2. Stored order (qr_code_order_create response)', name, 'Line total ex VAT', money(a.get('total_ex_vat')), money(b['total_ex_vat']))
add('2. Stored order (qr_code_order_create response)', 'All items', 'Order total ex VAT', money(java['created_total_ex_vat']), money(ruby['created_total_ex_vat']))
add('2. Stored order (qr_code_order_create response)', 'All items', 'VAT', money(java['created_vat']), money(ruby['created_vat']))

jb, rb = by_name(java['bill']), by_name(ruby['bill'])
for name in rb:
    a, b = jb.get(name, {}), rb[name]
    add('3. Bill (qr_print)', name, 'Add-ons on bill', a.get('add_ons') or '—', b['add_ons'] or '—')
    add('3. Bill (qr_print)', name, 'Item price incl. VAT', money(a.get('price_incl_vat')), money(b['price_incl_vat']))
    add('3. Bill (qr_print)', name, 'VAT on item', money(a.get('vat')), money(b['vat']))
add('3. Bill (qr_print)', 'All items', 'Bill total incl. VAT (net_payable_amount)', money(java['bill_totals']['net_payable_amount']), money(ruby['bill_totals']['net_payable_amount']))

ruby_paid = ruby.get('charged_on_telr') == ruby.get('charged_on_telr') and ruby.get('charged_on_telr')
ruby_note = f"Ruby run {ruby['order_number']} ({ruby['run_at'][11:16]} UTC)" if ruby_paid else 'Ruby value from 13:4x baseline run'
add('4. Payment', 'All items', 'Cart total on screen', money(java['cart_total_ui']), money(ruby['cart_total_ui']))
add('4. Payment', 'All items', 'Tip (default)', money(java['tip']), money(ruby['tip']) if ruby_paid else '4.00', ruby_note)
add('4. Payment', 'All items', 'Expected charge (cart + tip)', money(java['cart_total_ui'] + java['tip']), money(ruby['cart_total_ui'] + (ruby['tip'] if ruby_paid else 4)))
add('4. Payment', 'All items', 'Charged on Telr', money(java['charged_on_telr']), money(ruby['charged_on_telr']) if ruby_paid else '59.30', ruby_note)
add('4. Payment', 'All items', 'Amount on "Paid successfully" screen', money(java['success_screen_amount']), money(ruby['success_screen_amount']) if ruby_paid else '59.30', ruby_note)
add('4. Payment', 'All items', 'Tip saved after payment (qr_print tips)', money(java['paid_tips']), money(ruby.get('paid_tips')))

item_rows += [
    ['5. Mismatch breakdown (Java)', 'Paneer Dum Biryani', 'Add-on prices missing', '4.50', '0.00', 'DIFFERENT', 'Biryani Salan Dip 1.50 + Special Spiced Dates 3.00 (ISS-01)'],
    ['5. Mismatch breakdown (Java)', 'All items', 'Total VAT', f"{java['created_vat']:.2f}", f"{ruby['created_vat']:.2f}", 'DIFFERENT', f"Java misses {ruby['created_vat'] - java['created_vat']:.2f} VAT on the add-ons (already inside the 4.50, prices are VAT-inclusive)"],
    ['5. Mismatch breakdown (Java)', 'All items', 'Customer under-charged by', f"{java['cart_total_ui'] + java['tip'] - java['charged_on_telr']:.2f}", '0.00', 'DIFFERENT', f"expected {java['cart_total_ui'] + java['tip']:.2f}, charged {java['charged_on_telr']:.2f}"],
    ['5. Mismatch breakdown (Java)', 'All items', 'Success screen vs charged', f"{java['charged_on_telr'] - java['success_screen_amount']:.2f}", '0.00', 'DIFFERENT',
     f"screen {java['success_screen_amount']:.2f} = charged {java['charged_on_telr']:.2f} − VAT {java['created_vat']:.2f} − tip {java['tip']:.2f} (ISS-03)"],
    ['6. Cross-check: Ruby-created order paid via Java UI', 'All items', 'Bill total (Java qr_print)', money(settled['totals']['net_payable_amount']), money(ruby['bill_totals']['net_payable_amount']), 'MATCH', 'Java bills add-ons correctly when the order already has them'],
    ['6. Cross-check: Ruby-created order paid via Java UI', 'All items', 'Charged on Telr', settled['charged'].replace('Pay AED ', ''), '59.30', 'MATCH', 'Correct amount incl. AED 4 tip'],
    ['6. Cross-check: Ruby-created order paid via Java UI', 'All items', 'Bill line count', str(settled['totals']['total_items']), str(ruby['bill_totals']['total_items']), 'DIFFERENT', 'Java lists add-ons as separate lines (ISS-11)'],
]
item_rows.insert(0, ['Run', 'Order / invoice', 'Run time (UTC)', f"{java['order_number']} / {java['invoice_number']}  ({java['run_at'][:16]})",
                     f"{ruby['order_number']} / {ruby['invoice_number']}  ({ruby['run_at'][:16]})", 'N/A', 'Same QR, same customer, same items'])
sheet('Item Details (Java vs Ruby)', ['Section', 'Item', 'Detail', 'Java flow (qr_menu_v3)', 'Ruby flow (qr_menu)', 'Java vs Ruby', 'Note'],
      item_rows, [34, 22, 34, 44, 44, 13, 60], status_cols=(6,))

# ---------------------------------------------------------------- Diffs
diffs = [
    ['POST /qr_online_order/{code}', 'data.categories[*].items[*].recommended_item_ids[*]', 279, '10524 (values present)', '<missing> (empty array)', 'ISS-04'],
    ['POST /qr_online_order/{code}', 'data.categories[*].items[*].linked_item_ids[*]', 58, '10524 (values present)', '<missing> (empty array)', 'ISS-04'],
    ['POST /qr_online_order/{code}', 'data.multilingual_enabled', 1, 'false', '<missing>', 'ISS-04'],
    ['POST /qr_view_cart/{code}', 'data.order_items[*].base_mrp (add-on lines)', 2, '1.5 / 3', '0', 'ISS-05'],
    ['POST /qr_view_cart/{code}', 'data.order_items[*].offer_amount', 2, 'null', '0', 'ISS-05'],
    ['POST /qr_view_cart/{code}', 'data.order_items[*].notes', 1, '""', 'null', 'ISS-05'],
    ['POST /qr_view_cart/{code}', 'data.order_id', 1, 'null', '<missing>', 'ISS-05'],
    ['POST /qr_view_cart/{code}', 'data.uuid', 1, 'null', '<missing>', 'ISS-05'],
    ['GET /qr_online_order/{code}/items/{id}/options', '—', 0, 'identical (261 fields)', 'identical', ''],
    ['POST /qr_recommended_items/{code}', '—', 0, 'identical (124 fields)', 'identical', ''],
    ['GET /view_cart/?code=', '—', 0, 'identical', 'identical', ''],
    ['POST /qr_online_order/INVALID123', '—', 0, '422 Invalid QR Code', '422 Invalid QR Code', ''],
]
sheet('Ruby vs Java Diffs', ['Endpoint', 'Field', 'Occurrences', 'Ruby value', 'Java value', 'Issue ref'], diffs, [42, 56, 12, 26, 26, 10])

# ---------------------------------------------------------------- Environment
env = [
    ['New customer UI', 'https://biz.test.paytmcheckout.com/qr_menu_v3/?code=zeFdKxA86l'],
    ['Old customer UI (Ruby baseline)', 'https://biz.test.paytmcheckout.com/qr_menu/?code=zeFdKxA86l'],
    ['Java API host (expected)', 'https://dine-in-service-staging.paytmcheckout.com'],
    ['Ruby API host (old)', 'https://biz.test.paytmcheckout.com'],
    ['Restaurant', 'Kailash Parbat – Pure Veg Restaurant (account 1208, merchant 1224), currency AED, VAT 5% inclusive'],
    ['Test customer', 'QA Regression, +971 501234567 (table PIN 4567)'],
    ['Test card (Telr test mode)', '4000 0000 0000 0002, 06/28, CVV 123 – payment authorised'],
    ['Items used', 'Dahi ke Kebab AED 23.80; Paneer Dum Biryani AED 27.00 + Biryani Salan Dip 1.50 + Special Spiced Dates 3.00'],
    ['Tool', 'Playwright (Google Chrome, iPhone 13 emulation) – suite in /Users/sharathsp/Documents/v3-services'],
    ['Run all', 'npm test'],
    ['API only (no orders created)', 'npm run test:api'],
    ['End-to-end on Java (creates + pays 1 order)', 'npm run test:e2e'],
    ['End-to-end on Ruby (control)', 'npm run test:ruby-baseline (single payer, WITH_GUEST=0)'],
    ['HTML report with screenshots', 'npm run report'],
    ['Free a table left open by an interrupted run', 'npm run settle-table (joins with PIN and pays the full bill through the Java UI)'],
    ['Rebuild this Excel report', 'python3 reports/build_report.py (needs openpyxl + Pillow); uses reports/runs/*.json and reports/screenshots/java/*.png'],
    ['VPN note', 'Suite disables Chrome Local Network Access checks and uses the macOS system CA (corporate proxy); customers are not affected'],
]
sheet('Environment & How to Run', ['Item', 'Value'], env, [40, 110])

os.makedirs(os.path.dirname(OUT), exist_ok=True)
wb.save(OUT)
print(OUT)
