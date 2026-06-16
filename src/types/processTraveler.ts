/** 공정이동표(수검표) Excel 자동 기재용 */
export interface ProcessTravelerPrintData {
  order_no: string | null;
  customer_name: string | null;
  drawing_no: string | null;
  item_name: string | null;
  material: string | null;
  surface_treatment: string | null;
  order_quantity: number;
  due_date: string | null;
  instruction_memo: string | null;
}

export const PROCESS_TRAVELER_PRINT_SHEETS = [
  '수검표출력양식',
  '수검표출력양식_가로',
] as const;

export const PROCESS_TRAVELER_TEMPLATE_PATH =
  '/templates/process-traveler-template.xlsx';
