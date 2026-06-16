import type { PrintElement, PrintLayout, PrintPage } from '../../../types/printTemplate';

const A4_P = { w: 210, h: 297 };
const A4_L = { w: 297, h: 210 };

let _seq = 0;
function uid(prefix: string): string {
  _seq += 1;
  return `${prefix}_${_seq}`;
}

function textEl(
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  style?: PrintElement['style'],
): PrintElement {
  return {
    id: uid('t'),
    type: 'text',
    x,
    y,
    w,
    h,
    text,
    style: { fontSize: 9, ...style },
  };
}

function bindEl(
  x: number,
  y: number,
  w: number,
  h: number,
  bindKey: string,
  style?: PrintElement['style'],
): PrintElement {
  return {
    id: uid('b'),
    type: 'bind',
    x,
    y,
    w,
    h,
    bindKey,
    style: {
      fontSize: 9,
      borderWidth: 1,
      borderStyle: 'solid',
      paddingMm: 1,
      ...style,
    },
  };
}

function boxEl(
  x: number,
  y: number,
  w: number,
  h: number,
  style?: PrintElement['style'],
): PrintElement {
  return {
    id: uid('x'),
    type: 'box',
    x,
    y,
    w,
    h,
    style: { borderWidth: 1, borderStyle: 'solid', ...style },
  };
}

function lineEl(
  x: number,
  y: number,
  w: number,
  h: number,
  style?: PrintElement['style'],
): PrintElement {
  return {
    id: uid('l'),
    type: 'line',
    x,
    y,
    w,
    h,
    style: { borderWidth: 1, borderStyle: 'solid', ...style },
  };
}

function labelValueRow(
  y: number,
  label: string,
  bindKey: string,
  labelW = 22,
  valueW = 48,
  x = 10,
): PrintElement[] {
  return [
    textEl(x, y, labelW, 6, label, { fontWeight: 'bold', fontSize: 8 }),
    bindEl(x + labelW, y, valueW, 6, bindKey),
  ];
}

function buildPortraitPage(): PrintPage {
  const els: PrintElement[] = [];

  els.push(boxEl(8, 8, 194, 281));
  els.push(
    textEl(8, 10, 194, 10, '공 정 이 동 표 (수 검 표)', {
      fontSize: 16,
      fontWeight: 'bold',
      textAlign: 'center',
    }),
  );
  els.push(lineEl(8, 20, 194, 0.3));

  const rowY = [24, 31, 38, 45];
  els.push(...labelValueRow(rowY[0], '수주번호', 'order.order_no', 22, 40, 12));
  els.push(...labelValueRow(rowY[0], '고객사', 'order.customer_name', 22, 52, 76));
  els.push(...labelValueRow(rowY[1], '도면번호', 'order.drawing_no', 22, 40, 12));
  els.push(...labelValueRow(rowY[1], '품명', 'order.item_name', 22, 52, 76));
  els.push(...labelValueRow(rowY[2], '소재', 'order.material', 22, 40, 12));
  els.push(...labelValueRow(rowY[2], '후처리', 'order.surface_treatment', 22, 52, 76));
  els.push(...labelValueRow(rowY[3], '수량', 'order.order_quantity', 22, 40, 12));
  els.push(...labelValueRow(rowY[3], '납기', 'order.due_date', 22, 52, 76));

  els.push(textEl(12, 52, 22, 6, '작업지시', { fontWeight: 'bold', fontSize: 8 }));
  els.push(bindEl(34, 52, 164, 10, 'work_order.instruction_memo', { fontSize: 8 }));

  const tableTop = 66;
  const cols = [
    { x: 12, w: 28, label: '공정' },
    { x: 40, w: 24, label: '작업자' },
    { x: 64, w: 24, label: '일자' },
    { x: 88, w: 20, label: '투입' },
    { x: 108, w: 20, label: '양품' },
    { x: 128, w: 20, label: '불량' },
    { x: 148, w: 24, label: '판정' },
    { x: 172, w: 26, label: '비고' },
  ];

  els.push(boxEl(12, tableTop, 186, 8));
  for (const c of cols) {
    els.push(
      textEl(c.x, tableTop + 0.5, c.w, 7, c.label, {
        fontSize: 8,
        fontWeight: 'bold',
        textAlign: 'center',
      }),
    );
  }

  const processNames = [
    '수주접수',
    '도면배포',
    '가공(CNC)',
    '검사',
    '후처리',
    '최종검사',
    '출하대기',
  ];
  let row = tableTop + 8;
  for (const name of processNames) {
    els.push(boxEl(12, row, 186, 7));
    els.push(textEl(12, row + 0.5, 28, 6, name, { fontSize: 7.5, textAlign: 'center' }));
    for (let i = 1; i < cols.length; i++) {
      els.push(boxEl(cols[i].x, row, cols[i].w, 7));
    }
    row += 7;
  }

  const inspectTop = row + 4;
  els.push(textEl(12, inspectTop, 40, 6, '■ 수검·특기사항', { fontWeight: 'bold', fontSize: 9 }));
  els.push(boxEl(12, inspectTop + 7, 186, 40));

  const chkY = inspectTop + 50;
  ['치수', '외관', '재질', '포장'].forEach((label, i) => {
    els.push({
      id: uid('c'),
      type: 'checkbox',
      x: 14 + i * 22,
      y: chkY,
      w: 4,
      h: 4,
      text: label,
      style: { fontSize: 8 },
    });
  });

  return {
    id: 'page_portrait',
    name: '수검표출력양식',
    orientation: 'portrait',
    widthMm: A4_P.w,
    heightMm: A4_P.h,
    elements: els,
  };
}

function buildLandscapePage(): PrintPage {
  const els: PrintElement[] = [];

  els.push(boxEl(8, 8, 281, 194));
  els.push(
    textEl(8, 10, 281, 8, '공 정 흐 름 도 (가로)', {
      fontSize: 14,
      fontWeight: 'bold',
      textAlign: 'center',
    }),
  );
  els.push(lineEl(8, 18, 281, 0.3));

  const headers = [
    { label: '수주번호', key: 'order.order_no', x: 12, w: 32 },
    { label: '고객사', key: 'order.customer_name', x: 44, w: 38 },
    { label: '도면번호', key: 'order.drawing_no', x: 82, w: 32 },
    { label: '품명', key: 'order.item_name', x: 114, w: 38 },
    { label: '소재', key: 'order.material', x: 152, w: 28 },
    { label: '후처리', key: 'order.surface_treatment', x: 180, w: 28 },
    { label: '수량', key: 'order.order_quantity', x: 208, w: 18 },
    { label: '납기', key: 'order.due_date', x: 226, w: 28 },
  ];

  const dataY = 22;
  for (const h of headers) {
    els.push(textEl(h.x, dataY, h.w, 5, h.label, { fontSize: 7, fontWeight: 'bold', textAlign: 'center' }));
    els.push(bindEl(h.x, dataY + 5.5, h.w, 7, h.key, { fontSize: 8, textAlign: 'center' }));
  }

  const flowY = 38;
  const steps = ['수주', '배포', '가공', '검사', '후처리', '최종', '출하'];
  const stepW = 34;
  const gap = 4;
  let sx = 14;
  for (let i = 0; i < steps.length; i++) {
    els.push(boxEl(sx, flowY, stepW, 14));
    els.push(
      textEl(sx, flowY + 1, stepW, 5, steps[i], {
        fontSize: 8,
        fontWeight: 'bold',
        textAlign: 'center',
      }),
    );
    els.push(boxEl(sx + 2, flowY + 7, stepW - 4, 6));
    if (i < steps.length - 1) {
      els.push(textEl(sx + stepW, flowY + 5, gap, 4, '→', { fontSize: 10, textAlign: 'center' }));
    }
    sx += stepW + gap;
  }

  els.push(textEl(12, 58, 60, 5, '작업·검사 기록', { fontWeight: 'bold', fontSize: 9 }));
  els.push(boxEl(12, 64, 273, 130));

  const gridCols = 7;
  const gridRowH = 8;
  for (let r = 0; r < 14; r++) {
    for (let c = 0; c < gridCols; c++) {
      els.push(boxEl(12 + c * (273 / gridCols), 64 + r * gridRowH, 273 / gridCols, gridRowH));
    }
  }

  return {
    id: 'page_landscape',
    name: '수검표출력양식_가로',
    orientation: 'landscape',
    widthMm: A4_L.w,
    heightMm: A4_L.h,
    elements: els,
  };
}

export const PROCESS_TRAVELER_V8_LAYOUT: PrintLayout = {
  version: 1,
  pages: [buildPortraitPage(), buildLandscapePage()],
};

export const PROCESS_TRAVELER_V8_PRESET = {
  template_type: 'process_traveler' as const,
  name: '공정이동표 8차 (시스템)',
  description: '8차 수검표 양식 기본 프리셋 — 양면(세로+가로)',
  is_system_preset: true,
  is_default: true,
  layout_json: PROCESS_TRAVELER_V8_LAYOUT,
};

export const SYSTEM_PRESET_IDS = {
  process_traveler_v8: '00000000-0000-4000-8000-000000000001',
} as const;

export function cloneLayout(layout: PrintLayout): PrintLayout {
  return JSON.parse(JSON.stringify(layout)) as PrintLayout;
}
