-- orders 테이블 컬럼 추가
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS seq_no TEXT,
  ADD COLUMN IF NOT EXISTS vendor_unit_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendor_amount NUMERIC DEFAULT 0;

-- 순번 중복 방지 인덱스 (NULL 제외)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_seq_no
  ON orders(seq_no)
  WHERE seq_no IS NOT NULL;
