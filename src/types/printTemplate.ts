/** 공통 출력 템플릿 타입 */

import type { ExcelTemplateMapping, PrintEngineType } from './excelTemplate';

export type PrintTemplateType =
  | 'process_traveler'
  | 'production_log'
  | 'delivery_note'
  | 'production_schedule';

export type PrintElementType = 'text' | 'bind' | 'box' | 'line' | 'checkbox';

export interface PrintElementStyle {
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'none';
  background?: string;
  color?: string;
  paddingMm?: number;
}

export interface PrintElement {
  id: string;
  type: PrintElementType;
  /** mm from page left */
  x: number;
  /** mm from page top */
  y: number;
  w: number;
  h: number;
  /** static text (text type) or checkbox label */
  text?: string;
  /** field catalog key e.g. order.order_no */
  bindKey?: string;
  style?: PrintElementStyle;
}

export interface PrintPage {
  id: string;
  name: string;
  orientation: 'portrait' | 'landscape';
  widthMm: number;
  heightMm: number;
  elements: PrintElement[];
}

export interface PrintLayout {
  version: 1;
  pages: PrintPage[];
}

export interface PrintTemplate {
  id: string;
  template_type: PrintTemplateType;
  name: string;
  description: string | null;
  engine_type: PrintEngineType;
  /** Supabase Storage 경로 또는 /templates/... public 경로 */
  storage_path: string | null;
  mapping_json: ExcelTemplateMapping | null;
  is_system_preset: boolean;
  is_default: boolean;
  layout_json: PrintLayout;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/** 출력 시 데이터 — namespace.key 구조 */
export type PrintContext = Record<string, Record<string, unknown>>;

export interface PrintTemplateInput {
  template_type: PrintTemplateType;
  name: string;
  description?: string | null;
  engine_type?: PrintEngineType;
  storage_path?: string | null;
  mapping_json?: ExcelTemplateMapping | null;
  layout_json?: PrintLayout;
  is_default?: boolean;
}
