/*
# Thien Kim Sports Management Schema

1. New Tables
- `suppliers`: Nhà cung ứng (xưởng may, xưởng binh khí, kho dụng cụ)
- `products`: Sản phẩm với 2 bảng giá (HLV và Lẻ), tồn kho, nhóm hàng
- `customers`: Khách hàng theo SĐT, phân loại HLV/Lẻ
- `orders`: Đơn hàng với trạng thái thanh toán và giao hàng
- `order_items`: Chi tiết đơn hàng
- `supplier_debts`: Công nợ nhà cung ứng theo tháng
- `settings`: Cài đặt API keys, tài khoản ngân hàng
2. Security
- Single-tenant no-auth app: RLS enabled, TO anon, authenticated
3. Seed Data
- 4 nhà cung ứng, 12 sản phẩm mẫu, cài đặt mặc định
*/

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'general',
  contact_phone text,
  contact_zalo text,
  address text,
  note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON suppliers TO anon, authenticated;
DROP POLICY IF EXISTS "anon_crud_suppliers" ON suppliers;
CREATE POLICY "anon_crud_suppliers" ON suppliers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_suppliers" ON suppliers;
CREATE POLICY "anon_insert_suppliers" ON suppliers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_suppliers" ON suppliers;
CREATE POLICY "anon_update_suppliers" ON suppliers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_suppliers" ON suppliers;
CREATE POLICY "anon_delete_suppliers" ON suppliers FOR DELETE TO anon, authenticated USING (true);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  variant text,
  price_hlv bigint NOT NULL DEFAULT 0,
  price_le bigint NOT NULL DEFAULT 0,
  stock int NOT NULL DEFAULT 0,
  default_supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO anon, authenticated;
DROP POLICY IF EXISTS "anon_crud_products" ON products;
CREATE POLICY "anon_crud_products" ON products FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_products" ON products;
CREATE POLICY "anon_insert_products" ON products FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_products" ON products;
CREATE POLICY "anon_update_products" ON products FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_products" ON products;
CREATE POLICY "anon_delete_products" ON products FOR DELETE TO anon, authenticated USING (true);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  name text NOT NULL,
  customer_type text NOT NULL DEFAULT 'le',
  address text,
  note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON customers TO anon, authenticated;
DROP POLICY IF EXISTS "anon_crud_customers" ON customers;
CREATE POLICY "anon_crud_customers" ON customers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_customers" ON customers;
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_customers" ON customers;
CREATE POLICY "anon_delete_customers" ON customers FOR DELETE TO anon, authenticated USING (true);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code text NOT NULL UNIQUE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_phone text,
  customer_name text,
  customer_address text,
  price_type text NOT NULL DEFAULT 'le',
  total_amount bigint NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending',
  shipping_status text NOT NULL DEFAULT 'pending',
  shipping_carrier text,
  shipping_tracking text,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON orders TO anon, authenticated;
DROP POLICY IF EXISTS "anon_crud_orders" ON orders;
CREATE POLICY "anon_crud_orders" ON orders FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE TO anon, authenticated USING (true);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_sku text,
  product_name text,
  product_variant text,
  quantity int NOT NULL DEFAULT 1,
  unit_price bigint NOT NULL DEFAULT 0,
  subtotal bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON order_items TO anon, authenticated;
DROP POLICY IF EXISTS "anon_crud_order_items" ON order_items;
CREATE POLICY "anon_crud_order_items" ON order_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_order_items" ON order_items;
CREATE POLICY "anon_insert_order_items" ON order_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_order_items" ON order_items;
CREATE POLICY "anon_update_order_items" ON order_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_order_items" ON order_items;
CREATE POLICY "anon_delete_order_items" ON order_items FOR DELETE TO anon, authenticated USING (true);

-- Supplier Debts
CREATE TABLE IF NOT EXISTS supplier_debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  month text NOT NULL,
  opening_balance bigint NOT NULL DEFAULT 0,
  monthly_import bigint NOT NULL DEFAULT 0,
  paid_amount bigint NOT NULL DEFAULT 0,
  closing_balance bigint NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(supplier_id, month)
);
ALTER TABLE supplier_debts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON supplier_debts TO anon, authenticated;
DROP POLICY IF EXISTS "anon_crud_supplier_debts" ON supplier_debts;
CREATE POLICY "anon_crud_supplier_debts" ON supplier_debts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_supplier_debts" ON supplier_debts;
CREATE POLICY "anon_insert_supplier_debts" ON supplier_debts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_supplier_debts" ON supplier_debts;
CREATE POLICY "anon_update_supplier_debts" ON supplier_debts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_supplier_debts" ON supplier_debts;
CREATE POLICY "anon_delete_supplier_debts" ON supplier_debts FOR DELETE TO anon, authenticated USING (true);

-- Settings (single row)
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zalo_oa_api_key text,
  viettel_post_api_key text,
  viettel_post_customer_code text,
  mb_bank_account text,
  mb_bank_holder text,
  sacombank_account text,
  sacombank_holder text,
  company_name text DEFAULT 'Công ty TNHH Thể Thao Thiên Kim',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON settings TO anon, authenticated;
DROP POLICY IF EXISTS "anon_crud_settings" ON settings;
CREATE POLICY "anon_crud_settings" ON settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_settings" ON settings;
CREATE POLICY "anon_insert_settings" ON settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_settings" ON settings;
CREATE POLICY "anon_update_settings" ON settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_settings" ON settings;
CREATE POLICY "anon_delete_settings" ON settings FOR DELETE TO anon, authenticated USING (true);

-- Seed Suppliers (using gen_random_uuid via DO block for stable references)
DO $$
DECLARE
  s_may uuid;
  s_binhkhi uuid;
  s_dungcu uuid;
  s_aothun uuid;
  s_settings uuid;
BEGIN
  SELECT id INTO s_may FROM suppliers WHERE name = 'Xưởng may Võ phục Thiên Kim';
  IF s_may IS NULL THEN
    INSERT INTO suppliers (name, type, contact_phone, contact_zalo)
    VALUES ('Xưởng may Võ phục Thiên Kim', 'may', '0901234567', '0901234567')
    RETURNING id INTO s_may;
  END IF;

  SELECT id INTO s_binhkhi FROM suppliers WHERE name = 'Xưởng Binh khí Vovinam';
  IF s_binhkhi IS NULL THEN
    INSERT INTO suppliers (name, type, contact_phone, contact_zalo)
    VALUES ('Xưởng Binh khí Vovinam', 'binhkhi', '0912345678', '0912345678')
    RETURNING id INTO s_binhkhi;
  END IF;

  SELECT id INTO s_dungcu FROM suppliers WHERE name = 'Kho Dụng cụ Võ thuật';
  IF s_dungcu IS NULL THEN
    INSERT INTO suppliers (name, type, contact_phone, contact_zalo)
    VALUES ('Kho Dụng cụ Võ thuật', 'dungcu', '0923456789', '0923456789')
    RETURNING id INTO s_dungcu;
  END IF;

  SELECT id INTO s_aothun FROM suppliers WHERE name = 'Xưởng Áo thun Đồng phục';
  IF s_aothun IS NULL THEN
    INSERT INTO suppliers (name, type, contact_phone, contact_zalo)
    VALUES ('Xưởng Áo thun Đồng phục', 'aothun', '0934567890', '0934567890')
    RETURNING id INTO s_aothun;
  END IF;

  -- Seed Products
  INSERT INTO products (sku, name, category, variant, price_hlv, price_le, stock, default_supplier_id)
  VALUES
    ('VP-POLY-100', 'Võ phục Vovinam Polyte', 'Võ phục & Phụ kiện', 'Size 100', 96000, 136000, 25, s_may),
    ('VP-POLY-150', 'Võ phục Vovinam Polyte', 'Võ phục & Phụ kiện', 'Size 150', 114000, 154000, 18, s_may),
    ('VP-KAKI-160', 'Võ phục Vovinam Kaki dày', 'Võ phục & Phụ kiện', 'Size 160', 147000, 187000, 12, s_may),
    ('VP-KAKI-SOC-170', 'Võ phục Kaki sọc tâm cao cấp', 'Võ phục & Phụ kiện', 'Size 170', 350000, 390000, 8, s_may),
    ('BK-KIEMQ-Nhom', 'Kiếm quyền nhôm 6061', 'Binh khí Vovinam', 'Trơn', 440000, 480000, 7, s_binhkhi),
    ('BK-DONDAO-Tron', 'Đơn đao trơn thường', 'Binh khí Vovinam', 'Trơn', 330000, 370000, 5, s_binhkhi),
    ('BK-TRUONGCON-May', 'Trường côn mây bọc nhôm', 'Binh khí Vovinam', 'Mây bọc nhôm', 290000, 330000, 10, s_binhkhi),
    ('DC-BX08', 'Găng Boxing Buffalo 6oz', 'Dụng cụ võ thuật', 'BX08', 250000, 290000, 15, s_dungcu),
    ('DC-BX21', 'Găng Vovinam lõi đúc', 'Dụng cụ võ thuật', 'BX21', 420000, 460000, 6, s_dungcu),
    ('DC-MX1', 'Bảo hộ tay chân Vovinam', 'Dụng cụ võ thuật', 'S-M', 180000, 220000, 20, s_dungcu),
    ('DC-THAM26', 'Thảm xốp 2.6cm', 'Dụng cụ võ thuật', '26mm', 190000, 230000, 14, s_dungcu),
    ('AT-THUN-LANH', 'Áo thun đội nhóm Thun lạnh/Mè thái cổ tròn', 'Áo thun & Đồng phục', 'Đồng phục', 110000, 110000, 0, s_aothun)
  ON CONFLICT (sku) DO NOTHING;

  -- Seed Settings
  SELECT id INTO s_settings FROM settings LIMIT 1;
  IF s_settings IS NULL THEN
    INSERT INTO settings (mb_bank_account, mb_bank_holder, sacombank_account, sacombank_holder, company_name)
    VALUES ('0973166839', 'CONG TY TNHH THE THAO THIEN KIM', '060199565837', 'CONG TY TNHH THE THAO THIEN KIM', 'Công ty TNHH Thể Thao Thiên Kim');
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(default_supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(payment_status, shipping_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
