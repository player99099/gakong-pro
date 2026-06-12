import { supabase } from '../lib/supabase';
import type { Vendor } from '../types';

export type VendorInput = Omit<
  Vendor,
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'
>;

export async function fetchVendors(search?: string): Promise<Vendor[]> {
  let query = supabase
    .from('vendors')
    .select('*')
    .order('created_at', { ascending: false });

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(
      `vendor_name.ilike.${term},manager_name.ilike.${term},vendor_type.ilike.${term}`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createVendor(
  input: VendorInput,
  userEmail: string,
): Promise<Vendor> {
  const { data, error } = await supabase
    .from('vendors')
    .insert({ ...input, created_by: userEmail, updated_by: userEmail })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateVendor(
  id: string,
  input: VendorInput,
  userEmail: string,
): Promise<Vendor> {
  const { data, error } = await supabase
    .from('vendors')
    .update({ ...input, updated_by: userEmail })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteVendor(id: string): Promise<void> {
  const { error } = await supabase.from('vendors').delete().eq('id', id);
  if (error) throw error;
}
