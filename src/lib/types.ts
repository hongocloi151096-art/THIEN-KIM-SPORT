export interface Supplier {
  id: string;
  name: string;
  type: string;
  contact_phone: string | null;
  contact_zalo: string | null;
  address: string | null;
  note: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  variant: string | null;
  price_hlv: number;
  price_le: number;
  stock: number;
  default_supplier_id: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  phone: string;
  name: string;
  customer_type: string;
  address: string | null;
  note: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  order_code: string;
  customer_id: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  customer_address: string | null;
  price_type: string;
  total_amount: number;
  payment_status: string;
  shipping_status: string;
  shipping_carrier: string | null;
  shipping_tracking: string | null;
  supplier_id: string | null;
  note: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_sku: string | null;
  product_name: string | null;
  product_variant: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

export interface OrderWithItems extends Order {
  order_items?: OrderItem[];
}

export interface SupplierDebt {
  id: string;
  supplier_id: string;
  month: string;
  opening_balance: number;
  monthly_import: number;
  paid_amount: number;
  closing_balance: number;
  note: string | null;
  created_at: string;
}

export interface Settings {
  id: string;
  zalo_oa_api_key: string | null;
  viettel_post_api_key: string | null;
  viettel_post_customer_code: string | null;
  mb_bank_account: string | null;
  mb_bank_holder: string | null;
  sacombank_account: string | null;
  sacombank_holder: string | null;
  company_name: string | null;
  updated_at: string;
}

export const PRODUCT_CATEGORIES = [
  'Võ phục & Phụ kiện',
  'Binh khí Vovinam',
  'Dụng cụ võ thuật',
  'Áo thun & Đồng phục',
] as const;

export const CATEGORY_MARKUP: Record<string, number> = {
  'Võ phục & Phụ kiện': 40000,
  'Binh khí Vovinam': 40000,
  'Dụng cụ võ thuật': 40000,
};

export const TIERED_CATEGORIES = ['Áo thun & Đồng phục'];

export const TIERED_PRICING = {
  tiers: [
    { minQty: 0, maxQty: 19, price: 110000 },
    { minQty: 20, maxQty: 50, price: 105000 },
    { minQty: 51, maxQty: 999999, price: 100000 },
  ],
};
