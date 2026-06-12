import { supabase } from '../lib/supabase';
import type { CompanySettings, SettingItem } from '../types';

type SettingTable =
  | 'process_steps'
  | 'defect_types'
  | 'setup_types'
  | 'surface_treatments';

async function fetchSettings(table: SettingTable): Promise<SettingItem[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function createSetting(
  table: SettingTable,
  name: string,
  sortOrder: number,
): Promise<SettingItem> {
  const { data, error } = await supabase
    .from(table)
    .insert({ name, sort_order: sortOrder, is_active: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateSetting(
  table: SettingTable,
  id: string,
  updates: Partial<Pick<SettingItem, 'name' | 'sort_order' | 'is_active'>>,
): Promise<SettingItem> {
  const { data, error } = await supabase
    .from(table)
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export const fetchProcessSteps = () => fetchSettings('process_steps');
export const fetchDefectTypes = () => fetchSettings('defect_types');
export const fetchSetupTypes = () => fetchSettings('setup_types');
export const fetchSurfaceTreatments = () => fetchSettings('surface_treatments');

export const fetchActiveDefectTypes = async (): Promise<string[]> => {
  const items = await fetchDefectTypes();
  const active = items.filter((i) => i.is_active).map((i) => i.name);
  return active.length ? active : [];
};

export const fetchActiveSetupTypes = async (): Promise<string[]> => {
  const items = await fetchSetupTypes();
  const active = items.filter((i) => i.is_active).map((i) => i.name);
  return active.length ? active : [];
};

export const createProcessStep = (name: string, sort: number) =>
  createSetting('process_steps', name, sort);
export const updateProcessStep = (id: string, u: Partial<SettingItem>) =>
  updateSetting('process_steps', id, u);

export const createDefectType = (name: string, sort: number) =>
  createSetting('defect_types', name, sort);
export const updateDefectType = (id: string, u: Partial<SettingItem>) =>
  updateSetting('defect_types', id, u);

export const createSetupType = (name: string, sort: number) =>
  createSetting('setup_types', name, sort);
export const updateSetupType = (id: string, u: Partial<SettingItem>) =>
  updateSetting('setup_types', id, u);

export const createSurfaceTreatment = (name: string, sort: number) =>
  createSetting('surface_treatments', name, sort);
export const updateSurfaceTreatment = (id: string, u: Partial<SettingItem>) =>
  updateSetting('surface_treatments', id, u);

export async function fetchCompanySettings(): Promise<CompanySettings | null> {
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateCompanySettings(
  id: string,
  input: Partial<CompanySettings>,
  userEmail: string,
): Promise<CompanySettings> {
  const { data, error } = await supabase
    .from('company_settings')
    .update({ ...input, updated_by: userEmail })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
