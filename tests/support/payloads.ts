import { qrCode } from './config';

const itemColumns = ['id', 'item_id', 'price', 'quantity', 'total_price', 'offer_id', 'notes', 'net_price', 'variants', 'customizations', 'time_slot_id', 'delivery_option_id', 'item_instruction', 'origin'];
const customisationColumns = ['id', 'item_id', 'price', 'quantity', 'total_price', 'offer_id', 'notes', 'net_price', 'is_primary', 'variants', 'customizations', 'time_slot_id', 'delivery_option_id', 'customization_mapping_id'];

export type CartLine = {
  itemId: number;
  price: number;
  quantity?: number;
  addOns?: { id: number; price: number; mappingId: number }[];
};

/** Builds the column-array `order_items` format the web app sends to qr_view_cart / qr_code_order_create. */
export const orderItems = (lines: CartLine[]) => [
  itemColumns,
  ...lines.map(({ itemId, price, quantity = 1, addOns = [] }) => [
    '', String(itemId), price, quantity, price * quantity, '', null, price, {},
    addOns.length
      ? [customisationColumns, ...addOns.map((a) => [a.id, String(itemId), a.price, 1, a.price, null, null, a.price, null, null, null, null, null, a.mappingId])]
      : [],
    null, null, null, 'menu',
  ]),
];

export const viewCartBody = (lines: CartLine[]) => ({
  code: qrCode,
  order_source: 8,
  order_type: 'qr_order',
  delivery_type: 'dine_in',
  order_mode: 'b2c',
  order_items: orderItems(lines),
});
