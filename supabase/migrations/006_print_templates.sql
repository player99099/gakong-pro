-- 출력 템플릿 (공정이동표·생산일보·납품일지 등 공통)
-- SQL Editor 붙여넣기용

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS print_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_system_preset BOOLEAN DEFAULT FALSE,
  is_default BOOLEAN DEFAULT FALSE,
  layout_json JSONB NOT NULL DEFAULT '{"version":1,"pages":[]}'::jsonb,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_print_templates_type ON print_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_print_templates_default ON print_templates(template_type, is_default);

DROP TRIGGER IF EXISTS tr_print_templates_updated ON print_templates;
CREATE TRIGGER tr_print_templates_updated BEFORE UPDATE ON print_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE print_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users full access" ON print_templates;
CREATE POLICY "Authenticated users full access" ON print_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
