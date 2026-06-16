/** ISO 날짜(YYYY-MM-DD) 또는 Date → Excel 일련번호 (1900 날짜 체계) */
export function toExcelSerialDate(value: string | Date | null | undefined): number | null {
  if (value == null || value === '') return null;

  const date =
    value instanceof Date
      ? value
      : (() => {
          const trimmed = String(value).trim();
          const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (m) {
            return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
          }
          const parsed = new Date(trimmed);
          return Number.isNaN(parsed.getTime()) ? null : parsed;
        })();

  if (!date) return null;

  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const excelEpoch = Date.UTC(1899, 11, 30);
  return Math.floor((utc - excelEpoch) / 86400000);
}

export function todayExcelSerial(): number {
  return toExcelSerialDate(new Date()) ?? 0;
}
