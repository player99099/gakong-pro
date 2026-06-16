-- 작업지시(work_orders) 최소 적용 — SQL Editor 붙여넣기용
-- 003_full_mvp.sql 전체 대신 작업지시 메뉴만 급히 켤 때 사용

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS produced_quantity NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS defect_quantity NUMERIC DEFAULT 0;

CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_no TEXT,
  drawing_no TEXT,
  item_name TEXT,
  order_quantity NUMERIC DEFAULT 0,
  due_date DATE,
  process_status TEXT DEFAULT '수주접수',
  instruction_memo TEXT,
  drawing_file_name TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_orders_order ON work_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(process_status);

DROP TRIGGER IF EXISTS tr_work_orders_updated ON work_orders;
CREATE TRIGGER tr_work_orders_updated BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users full access" ON work_orders;
CREATE POLICY "Authenticated users full access" ON work_orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
