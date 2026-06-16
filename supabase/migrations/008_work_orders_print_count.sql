-- 작업지시 공정이동표 출력 횟수
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS print_count INTEGER NOT NULL DEFAULT 0;
