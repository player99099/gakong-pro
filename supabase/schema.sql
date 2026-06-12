-- 가공관리 Pro - Supabase 테이블 스키마
-- Supabase SQL Editor에서 실행하세요.

-- users_profile
CREATE TABLE IF NOT EXISTS users_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- customers
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  manager_name TEXT,
  phone TEXT,
  company_email TEXT,
  personal_email TEXT,
  address TEXT,
  business_type TEXT,
  memo TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- vendors
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name TEXT NOT NULL,
  vendor_type TEXT,
  manager_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  business_type TEXT,
  memo TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- items
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  drawing_no TEXT,
  item_name TEXT NOT NULL,
  material TEXT,
  surface_treatment TEXT,
  level TEXT,
  item_type TEXT,
  quantity NUMERIC DEFAULT 0,
  total_quantity NUMERIC DEFAULT 0,
  unit_price NUMERIC DEFAULT 0,
  memo TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- bom_items
CREATE TABLE IF NOT EXISTS bom_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  no INTEGER DEFAULT 1,
  level TEXT,
  drawing_no TEXT,
  item_name TEXT NOT NULL,
  material TEXT,
  surface_treatment TEXT,
  item_type TEXT,
  quantity NUMERIC DEFAULT 0,
  total_quantity NUMERIC DEFAULT 0,
  unit_price NUMERIC DEFAULT 0,
  memo TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_no TEXT,
  received_date DATE,
  due_date DATE,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  drawing_no TEXT,
  item_name TEXT,
  material TEXT,
  order_quantity NUMERIC DEFAULT 0,
  unit_price NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  surface_treatment TEXT,
  project_name TEXT,
  person_in_charge TEXT,
  progress_place TEXT,
  drawing_file_name TEXT,
  memo1 TEXT,
  memo2 TEXT,
  order_status TEXT DEFAULT '접수',
  process_status TEXT DEFAULT '수주접수',
  delivered_quantity NUMERIC DEFAULT 0,
  remaining_quantity NUMERIC DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(customer_name);
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(vendor_name);
CREATE INDEX IF NOT EXISTS idx_items_customer ON items(customer_id);
CREATE INDEX IF NOT EXISTS idx_bom_parent ON bom_items(parent_item_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_due_date ON orders(due_date);

-- updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_users_profile_updated BEFORE UPDATE ON users_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_customers_updated BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_vendors_updated BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_items_updated BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_bom_items_updated BEFORE UPDATE ON bom_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS 활성화
ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자 전체 접근 정책 (1차 개발용)
CREATE POLICY "Authenticated users full access" ON users_profile
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON vendors
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON bom_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
