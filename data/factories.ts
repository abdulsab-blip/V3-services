export enum TablePreference {
  QSR_PREPAID = 1,
  DINE_IN = 2,
  VIEW_AND_PAY_BILL = 3,
  TAKEAWAY = 4,
}

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;
export const unique = (prefix: string) => `${prefix}_${stamp()}`;

export interface SalesLead {
  merchantName: string;
  contactName: string;
  mobile: string;
  email: string;
  city: string;
  address: string;
}
export interface Outlet {
  name: string;
  address: string;
  city: string;
  pincode: string;
  tablePreference: TablePreference;
}
export interface Category {
  name: string;
}
export interface Group {
  name: string;
  category: string;
}
export interface Item {
  name: string;
  price: number;
  group: string;
  category: string;
  veg: boolean;
  inStock: boolean;
}

export const buildSalesLead = (o: Partial<SalesLead> = {}): SalesLead => {
  const id = stamp();
  return {
    merchantName: `QA Merchant ${id}`,
    contactName: 'QA Contact',
    mobile: `9${id.slice(-9)}`,
    email: `qa.merchant.${id}@example.com`,
    city: 'Bengaluru',
    address: `${id.slice(-4)} MG Road`,
    ...o,
  };
};

export const buildOutlet = (o: Partial<Outlet> = {}): Outlet => ({
  name: unique('Outlet'),
  address: `${stamp().slice(-4)} Residency Road`,
  city: 'Bengaluru',
  pincode: '560025',
  tablePreference: TablePreference.DINE_IN,
  ...o,
});

export const buildCategory = (o: Partial<Category> = {}): Category => ({ name: unique('Cat'), ...o });

export const buildGroup = (category: string, o: Partial<Group> = {}): Group => ({
  name: unique('Grp'),
  category,
  ...o,
});

export const buildItem = (category: string, group: string, o: Partial<Item> = {}): Item => ({
  name: unique('Item'),
  price: 199,
  category,
  group,
  veg: true,
  inStock: true,
  ...o,
});
