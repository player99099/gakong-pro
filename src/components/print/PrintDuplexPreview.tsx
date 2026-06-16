import { useEffect, useMemo, useState } from 'react';
import type { PrintContext, PrintLayout, PrintPage } from '../../types/printTemplate';
import { PrintCanvas } from './PrintCanvas';

const MM_TO_PX = 3.7795275591;

function pageLabel(page: PrintPage, index: number, total: number): string {
  if (total <= 1) return page.name || '미리보기';
  if (index === 0) {
    return page.orientation === 'landscape'
      ? `1면 · 앞 (가로) — ${page.name}`
      : `1면 · 앞 (세로) — ${page.name}`;
  }
  return page.orientation === 'landscape'
    ? `2면 · 뒤 (가로) — ${page.name}`
    : `2면 · 뒤 (세로) — ${page.name}`;
}

function scaledPageBox(page: PrintPage, scale: number) {
  const wPx = page.widthMm * MM_TO_PX * scale;
  const hPx = page.heightMm * MM_TO_PX * scale;
  return { wPx, hPx };
}

interface PrintDuplexPreviewProps {
  layout: PrintLayout;
  context: PrintContext;
  /** 미리보기 영역 최대 너비(px) */
  maxWidthPx?: number;
}

export function PrintDuplexPreview({
  layout,
  context,
  maxWidthPx = 720,
}: PrintDuplexPreviewProps) {
  const pages = layout.pages;
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [layout]);

  const activePage = pages[activeIndex] ?? pages[0];

  const scale = useMemo(() => {
    if (!activePage) return 0.5;
    const naturalW = activePage.widthMm * MM_TO_PX;
    return Math.min(0.85, maxWidthPx / naturalW);
  }, [activePage, maxWidthPx]);

  if (!activePage) {
    return <p className="text-muted">미리보기할 페이지가 없습니다.</p>;
  }

  const { wPx, hPx } = scaledPageBox(activePage, scale);
  const singlePageLayout: PrintLayout = { version: 1, pages: [activePage] };

  return (
    <div className="print-duplex-preview">
      {pages.length > 1 && (
        <div className="print-duplex-preview__tabs">
          {pages.map((page, idx) => (
            <button
              key={page.id}
              type="button"
              className={`print-duplex-preview__tab ${idx === activeIndex ? 'active' : ''}`}
              onClick={() => setActiveIndex(idx)}
            >
              {pageLabel(page, idx, pages.length)}
            </button>
          ))}
        </div>
      )}

      <div className="print-duplex-preview__frame">
        <div
          className="print-duplex-preview__scaled"
          style={{ width: wPx, height: hPx }}
        >
          <div
            className="print-duplex-preview__inner"
            style={{
              width: `${activePage.widthMm}mm`,
              height: `${activePage.heightMm}mm`,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <PrintCanvas layout={singlePageLayout} context={context} />
          </div>
        </div>
      </div>

      {pages.length > 1 && (
        <p className="print-duplex-preview__hint text-muted">
          양면 인쇄: 1면(앞) → 2면(뒤) 순서로 프린터에 출력됩니다. 탭을 전환해 각 면을 확인하세요.
        </p>
      )}
    </div>
  );
}
