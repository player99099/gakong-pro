/**
 * Excel → PrintLayout 파서 스모크 테스트
 * node scripts/test-print-import.mjs [xlsx-path]
 */
import { readFileSync } from 'fs';
import ExcelJS from 'exceljs';

const path = process.argv[2] ?? 'c:/Users/HIM/Desktop/공정이동표.xlsx';
const buf = readFileSync(path);
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buf);

const sheets = wb.worksheets.filter((ws) => ws.state !== 'veryHidden');
console.log('Sheets:', sheets.map((s) => s.name));

const portrait = sheets.find((s) => s.pageSetup?.orientation !== 'landscape');
const landscape = sheets.find((s) => s.pageSetup?.orientation === 'landscape');

for (const ws of [portrait, landscape].filter(Boolean)) {
  const area = ws.pageSetup?.printArea;
  console.log('\n', ws.name, area, ws.pageSetup?.orientation);
  const binds = {
    portrait: { D2: 'order_no', O2: 'customer', D3: 'drawing', O3: 'item', D4: 'material', T4: 'due', O5: 'qty', O6: 'surface' },
    landscape: { B2: 'customer', C2: 'drawing', D2: 'material', E2: 'surface', F2: 'qty', G2: 'due', H2: 'memo' },
  };
  const map = ws === landscape ? binds.landscape : binds.portrait;
  for (const [addr] of Object.entries(map)) {
    console.log(' ', addr, '→', ws.getCell(addr).value != null ? 'has value' : 'empty');
  }
}

console.log('\nOK — parser integration test via build (npm run build)');
