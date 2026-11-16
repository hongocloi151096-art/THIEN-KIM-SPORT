export interface Supplier {
  id: string;
  name: string;
  type: string;
  contact_phone: string | null;
  contact_zalo: string | null;
  address: string | null;
  note: string | null;
  zalo_group_id: string | null;
  messenger_group_id: string | null;
  default_channel: string;
  created_at: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  sub_category: string | null;
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
  sales_staff_id: string | null;
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
  supplier_id: string | null;
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

export interface SalesStaff {
  id: string;
  name: string;
  phone: string;
  zalo_session_key: string | null;
  messenger_session_key: string | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
}

export interface MessageOutbox {
  id: string;
  channel: string;
  sender_session_key: string | null;
  recipient: string | null;
  recipient_type: string | null;
  content: string;
  status: string;
  related_order_id: string | null;
  related_supplier_id: string | null;
  created_at: string;
  sent_at: string | null;
}

export const PRODUCT_CATEGORIES = [
  'Võ phục & Phụ kiện',
  'Dụng cụ võ thuật',
  'Binh khí Vovinam',
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

export const SUB_CATEGORIES: Record<string, string[]> = {
  'Võ phục & Phụ kiện': [
    'Vovinam',
    'Taekwondo',
    'Võ Cổ Truyền',
    'Karate',
    'Judo/Aikido',
    'Đai & Bảng tên',
  ],
  'Dụng cụ võ thuật': [
    'Găng tay & Đích đá',
    'Giáp & Bảo hộ',
    'Thảm & Dụng cụ tập',
  ],
  'Binh khí Vovinam': [
    'Kiếm & Đao',
    'Trường côn & Binh khí khác',
  ],
  'Áo thun & Đồng phục': [
    'Áo thun cổ tròn',
    'Áo thun có cổ / Polo',
    'Đồng phục CLB',
  ],
};

export const ALL_SUB_CATEGORIES: string[] = Object.values(SUB_CATEGORIES).flat();

export type SupplierChannel = 'zalo_group' | 'messenger_group' | 'both';

export const SUPPLIER_CHANNELS: { value: SupplierChannel; label: string }[] = [
  { value: 'zalo_group', label: 'Zalo' },
  { value: 'messenger_group', label: 'Messenger' },
  { value: 'both', label: 'Cả Zalo & Messenger' },
];

export type VipTier = 'kim_cuong' | 'vang' | 'bac' | 'none';

export const VIP_TIERS = {
  kim_cuong: { label: 'Kim Cương', min: 50_000_000 },
  vang: { label: 'Vàng', min: 20_000_000 },
  bac: { label: 'Bạc', min: 10_000_000 },
} as const;

export function getVipTier(totalRevenue: number): VipTier {
  if (totalRevenue >= VIP_TIERS.kim_cuong.min) return 'kim_cuong';
  if (totalRevenue >= VIP_TIERS.vang.min) return 'vang';
  if (totalRevenue >= VIP_TIERS.bac.min) return 'bac';
  return 'none';
}
