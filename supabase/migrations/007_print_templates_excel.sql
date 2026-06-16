-- print_templates Excel 엔진 컬럼 추가
-- SQL Editor 붙여넣기용 (006 적용 후)

ALTER TABLE print_templates ADD COLUMN IF NOT EXISTS engine_type TEXT NOT NULL DEFAULT 'html';
ALTER TABLE print_templates ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE print_templates ADD COLUMN IF NOT EXISTS mapping_json JSONB;

COMMENT ON COLUMN print_templates.engine_type IS 'html | excel';
COMMENT ON COLUMN print_templates.storage_path IS 'Supabase Storage 경로 또는 /templates/... public';
COMMENT ON COLUMN print_templates.mapping_json IS 'Excel 셀 ↔ 필드 매핑';
