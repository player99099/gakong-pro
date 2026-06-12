import { supabase } from '../lib/supabase';
import type { BomItem, Item } from '../types';

export type ItemInput = Omit<
  Item,
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by' | 'customers'
>;

export type BomItemInput = Omit<
  BomItem,
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'
>;

export async function fetchItems(search?: string): Promise<Item[]> {
  let query = supabase
    .from('items')
    .select('*, customers(customer_name)')
    .order('created_at', { ascending: false });

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(
      `drawing_no.ilike.${term},item_name.ilike.${term},material.ilike.${term}`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchItemById(id: string): Promise<Item | null> {
  const { data, error } = await supabase
    .from('items')
    .select('*, customers(customer_name)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createItem(
  input: ItemInput,
  userEmail: string,
): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .insert({ ...input, created_by: userEmail, updated_by: userEmail })
    .select('*, customers(customer_name)')
    .single();

  if (error) throw error;
  return data;
}

export async function updateItem(
  id: string,
  input: ItemInput,
  userEmail: string,
): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .update({ ...input, updated_by: userEmail })
    .eq('id', id)
    .select('*, customers(customer_name)')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchBomItems(parentItemId: string): Promise<BomItem[]> {
  const { data, error } = await supabase
    .from('bom_items')
    .select('*')
    .eq('parent_item_id', parentItemId)
    .order('no', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createBomItem(
  input: BomItemInput,
  userEmail: string,
): Promise<BomItem> {
  const { data, error } = await supabase
    .from('bom_items')
    .insert({ ...input, created_by: userEmail, updated_by: userEmail })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBomItem(
  id: string,
  input: BomItemInput,
  userEmail: string,
): Promise<BomItem> {
  const { data, error } = await supabase
    .from('bom_items')
    .update({ ...input, updated_by: userEmail })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBomItem(id: string): Promise<void> {
  const { error } = await supabase.from('bom_items').delete().eq('id', id);
  if (error) throw error;
}
