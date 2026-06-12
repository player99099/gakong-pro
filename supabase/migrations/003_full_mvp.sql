-- 003: 전체 업무 흐름 MVP (작업지시, 생산관리, 생산일보, 설정)
-- 기존 DB에 적용. 002_deliveries.sql 이후 실행.

-- orders 컬럼 추가
ALTER TABLE orders ADD COLUMN IF NOT EXISTS produced_quantity NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS defect_quantity NUMERIC DEFAULT 0;

-- work_orders
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

-- process_logs (공정 변경 이력)
CREATE TABLE IF NOT EXISTS process_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  memo TEXT,
  changed_by TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- production_logs (생산일보)
CREATE TABLE IF NOT EXISTS production_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  work_date DATE NOT NULL,
  worker_name TEXT NOT NULL,
  department TEXT,
  equipment TEXT,
  customer_name TEXT,
  order_no TEXT,
  drawing_no TEXT,
  item_name TEXT,
  processing_minutes NUMERIC DEFAULT 0,
  production_quantity NUMERIC DEFAULT 0,
  defect_quantity NUMERIC DEFAULT 0,
  defect_type TEXT,
  defect_note TEXT,
  setup_minutes NUMERIC DEFAULT 0,
  setup_type TEXT,
  note TEXT,
  special_note TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 설정 테이블
CREATE TABLE IF NOT EXISTS process_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS defect_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS setup_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS surface_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT,
  business_no TEXT,
  ceo_name TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  memo TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_work_orders_order ON work_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(process_status);
CREATE INDEX IF NOT EXISTS idx_process_logs_order ON process_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_production_logs_order ON production_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_production_logs_date ON production_logs(work_date);

-- 트리거
CREATE TRIGGER tr_work_orders_updated BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_production_logs_updated BEFORE UPDATE ON production_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_process_steps_updated BEFORE UPDATE ON process_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_defect_types_updated BEFORE UPDATE ON defect_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_setup_types_updated BEFORE UPDATE ON setup_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_surface_treatments_updated BEFORE UPDATE ON surface_treatments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_company_settings_updated BEFORE UPDATE ON company_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE defect_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE setup_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE surface_treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access" ON work_orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON process_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON production_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON process_steps
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON defect_types
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON setup_types
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON surface_treatments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON company_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 기본 seed (없을 때만)
INSERT INTO process_steps (name, sort_order) SELECT * FROM (VALUES
  ('수주접수', 1), ('도면배포', 2), ('생산', 3), ('후처리', 4), ('출하검사', 5), ('출하대기', 6)
) AS v(name, sort_order) WHERE NOT EXISTS (SELECT 1 FROM process_steps LIMIT 1);

INSERT INTO defect_types (name, sort_order) SELECT * FROM (VALUES
  ('치수불량', 1), ('표면불량', 2), ('공구파손', 3), ('소재불량', 4),
  ('프로그램오류', 5), ('셋업오류', 6), ('기타', 7)
) AS v(name, sort_order) WHERE NOT EXISTS (SELECT 1 FROM defect_types LIMIT 1);

INSERT INTO setup_types (name, sort_order) SELECT * FROM (VALUES
  ('공구교체', 1), ('프로그램변경', 2), ('지그변경', 3), ('기타', 4)
) AS v(name, sort_order) WHERE NOT EXISTS (SELECT 1 FROM setup_types LIMIT 1);

INSERT INTO company_settings (company_name) SELECT '가공관리 Pro'
WHERE NOT EXISTS (SELECT 1 FROM company_settings LIMIT 1);
