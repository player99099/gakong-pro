import { supabase } from '../lib/supabase';
import {
  buildDefaultProcessTravelerMapping,
  DEFAULT_PROCESS_TRAVELER_STORAGE,
} from '../lib/print/excel/buildExcelMapping';
import { SYSTEM_PRESET_IDS } from '../lib/print/presets/processTravelerV8';
import { cloneLayout } from '../lib/print/presets/processTravelerV8';
import type { ExcelTemplateMapping } from '../types/excelTemplate';
import { EMPTY_PRINT_LAYOUT } from '../types/excelTemplate';
import type {
  PrintLayout,
  PrintTemplate,
  PrintTemplateInput,
  PrintTemplateType,
} from '../types/printTemplate';

function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  const message = String((err as { message?: string }).message ?? '');
  return code === 'PGRST205' || message.includes('print_templates');
}

function normalizePrintTemplate(row: Record<string, unknown>): PrintTemplate {
  const r = row as unknown as PrintTemplate;
  return {
    ...r,
    engine_type: r.engine_type ?? 'html',
    storage_path: r.storage_path ?? null,
    mapping_json: r.mapping_json ?? null,
    layout_json: r.layout_json ?? EMPTY_PRINT_LAYOUT,
  };
}

function virtualExcelProcessTravelerTemplate(): PrintTemplate {
  const now = new Date().toISOString();
  return {
    id: SYSTEM_PRESET_IDS.process_traveler_v8,
    template_type: 'process_traveler',
    name: '공정이동표 (Excel)',
    description: 'Excel 원본 양식 — public/templates/process-traveler-default.xlsx',
    engine_type: 'excel',
    storage_path: DEFAULT_PROCESS_TRAVELER_STORAGE,
    mapping_json: buildDefaultProcessTravelerMapping(),
    is_system_preset: true,
    is_default: true,
    layout_json: EMPTY_PRINT_LAYOUT,
    created_by: null,
    updated_by: null,
    created_at: now,
    updated_at: now,
  };
}

const SYSTEM_PRESETS: Partial<Record<PrintTemplateType, PrintTemplate>> = {
  process_traveler: virtualExcelProcessTravelerTemplate(),
};

export async function fetchPrintTemplates(
  templateType?: PrintTemplateType,
): Promise<PrintTemplate[]> {
  let query = supabase
    .from('print_templates')
    .select('*')
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });

  if (templateType) {
    query = query.eq('template_type', templateType);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(error)) {
      if (templateType && SYSTEM_PRESETS[templateType]) {
        return [SYSTEM_PRESETS[templateType]!];
      }
      return Object.values(SYSTEM_PRESETS).filter(Boolean) as PrintTemplate[];
    }
    throw error;
  }

  const rows = (data ?? []).map((r) => normalizePrintTemplate(r as Record<string, unknown>));
  if (rows.length === 0 && templateType && SYSTEM_PRESETS[templateType]) {
    return [SYSTEM_PRESETS[templateType]!];
  }
  return rows;
}

export async function fetchPrintTemplateById(id: string): Promise<PrintTemplate | null> {
  const { data, error } = await supabase
    .from('print_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      for (const preset of Object.values(SYSTEM_PRESETS)) {
        if (preset?.id === id) return preset;
      }
      return SYSTEM_PRESETS.process_traveler ?? null;
    }
    throw error;
  }

  if (data) return normalizePrintTemplate(data as Record<string, unknown>);

  for (const preset of Object.values(SYSTEM_PRESETS)) {
    if (preset?.id === id) return preset;
  }
  return null;
}

export async function getDefaultPrintTemplate(
  templateType: PrintTemplateType,
): Promise<PrintTemplate> {
  const { data, error } = await supabase
    .from('print_templates')
    .select('*')
    .eq('template_type', templateType)
    .eq('is_default', true)
    .maybeSingle();

  if (error && !isMissingTableError(error)) throw error;

  if (data) return normalizePrintTemplate(data as Record<string, unknown>);

  const { data: anyRow } = await supabase
    .from('print_templates')
    .select('*')
    .eq('template_type', templateType)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (anyRow) return normalizePrintTemplate(anyRow as Record<string, unknown>);

  const fallback = SYSTEM_PRESETS[templateType];
  if (fallback) return fallback;

  throw new Error(`기본 출력 양식(${templateType})을 찾을 수 없습니다.`);
}

export async function ensureSystemPrintTemplates(userEmail: string | null): Promise<void> {
  const preset = virtualExcelProcessTravelerTemplate();
  const id = SYSTEM_PRESET_IDS.process_traveler_v8;

  const { data: existing, error: readErr } = await supabase
    .from('print_templates')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (readErr) {
    if (isMissingTableError(readErr)) return;
    throw readErr;
  }

  if (existing) return;

  const { error: insertErr } = await supabase.from('print_templates').insert({
    id,
    template_type: preset.template_type,
    name: preset.name,
    description: preset.description,
    engine_type: 'excel',
    storage_path: preset.storage_path,
    mapping_json: preset.mapping_json,
    is_system_preset: true,
    is_default: true,
    layout_json: EMPTY_PRINT_LAYOUT,
    created_by: userEmail,
    updated_by: userEmail,
  });

  if (insertErr && !isMissingTableError(insertErr)) throw insertErr;
}

export async function createPrintTemplate(
  input: PrintTemplateInput,
  userEmail: string | null,
  id?: string,
): Promise<PrintTemplate> {
  const payload: Record<string, unknown> = {
    template_type: input.template_type,
    name: input.name,
    description: input.description ?? null,
    engine_type: input.engine_type ?? 'html',
    storage_path: input.storage_path ?? null,
    mapping_json: input.mapping_json ?? null,
    is_system_preset: false,
    is_default: input.is_default ?? false,
    layout_json: input.layout_json ?? EMPTY_PRINT_LAYOUT,
    created_by: userEmail,
    updated_by: userEmail,
  };
  if (id) payload.id = id;

  const { data, error } = await supabase
    .from('print_templates')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return normalizePrintTemplate(data as Record<string, unknown>);
}

export async function updatePrintTemplate(
  id: string,
  updates: {
    name?: string;
    description?: string | null;
    layout_json?: PrintLayout;
    mapping_json?: ExcelTemplateMapping | null;
    storage_path?: string | null;
    is_default?: boolean;
  },
  userEmail: string | null,
): Promise<PrintTemplate> {
  const { data: current, error: readErr } = await supabase
    .from('print_templates')
    .select('is_system_preset, template_type')
    .eq('id', id)
    .single();

  if (readErr) throw readErr;

  if (updates.is_default && current.template_type) {
    await supabase
      .from('print_templates')
      .update({ is_default: false })
      .eq('template_type', current.template_type);
  }

  const payload: Record<string, unknown> = { updated_by: userEmail };
  if (updates.name != null) payload.name = updates.name;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.layout_json) payload.layout_json = updates.layout_json;
  if (updates.mapping_json !== undefined) payload.mapping_json = updates.mapping_json;
  if (updates.storage_path !== undefined) payload.storage_path = updates.storage_path;
  if (updates.is_default != null) payload.is_default = updates.is_default;

  const { data, error } = await supabase
    .from('print_templates')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return normalizePrintTemplate(data as Record<string, unknown>);
}

export async function duplicatePrintTemplate(
  id: string,
  newName: string,
  userEmail: string | null,
): Promise<PrintTemplate> {
  const source = await fetchPrintTemplateById(id);
  if (!source) throw new Error('복사할 양식을 찾을 수 없습니다.');

  return createPrintTemplate(
    {
      template_type: source.template_type,
      name: newName,
      description: source.description,
      engine_type: source.engine_type,
      storage_path: source.storage_path,
      mapping_json: source.mapping_json,
      layout_json: cloneLayout(source.layout_json),
      is_default: false,
    },
    userEmail,
  );
}

export async function setDefaultPrintTemplate(
  id: string,
  userEmail: string | null,
): Promise<void> {
  const tpl = await fetchPrintTemplateById(id);
  if (!tpl) throw new Error('양식을 찾을 수 없습니다.');

  await supabase
    .from('print_templates')
    .update({ is_default: false, updated_by: userEmail })
    .eq('template_type', tpl.template_type);

  const { error } = await supabase
    .from('print_templates')
    .update({ is_default: true, updated_by: userEmail })
    .eq('id', id);

  if (error) throw error;
}

export async function deletePrintTemplate(id: string): Promise<void> {
  const { data, error: readErr } = await supabase
    .from('print_templates')
    .select('is_system_preset')
    .eq('id', id)
    .single();

  if (readErr) throw readErr;
  if (data.is_system_preset) {
    throw new Error('시스템 기본 양식은 삭제할 수 없습니다.');
  }

  const { error } = await supabase.from('print_templates').delete().eq('id', id);
  if (error) throw error;
}

export function isExcelPrintTemplate(template: PrintTemplate): boolean {
  return template.engine_type === 'excel' && !!template.storage_path && !!template.mapping_json;
}
