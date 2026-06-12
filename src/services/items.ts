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

export interface DrawingLookupResult {
  source: 'item' | 'bom';
  item_id: string;
  drawing_no: string;
  item_name: string;
  material: string | null;
  surface_treatment: string | null;
  unit_price: number;
  customer_id: string | null;
  customer_name: string | null;
}

function isDrawingMatch(
  stored: string | null | undefined,
  input: string,
): boolean {
  return (stored ?? '').trim().toLowerCase() === input.trim().toLowerCase();
}

export async function lookupByDrawingNo(
  drawingNo: string,
): Promise<DrawingLookupResult | null> {
  const trimmed = drawingNo.trim();
  if (!trimmed) return null;

  const { data: itemRows, error: itemError } = await supabase
    .from('items')
    .select('*, customers(customer_name)')
    .ilike('drawing_no', trimmed);

  if (itemError) throw itemError;

  const item = (itemRows ?? []).find((row) =>
    isDrawingMatch(row.drawing_no, trimmed),
  );
  if (item) {
    return {
      source: 'item',
      item_id: item.id,
      drawing_no: item.drawing_no ?? trimmed,
      item_name: item.item_name,
      material: item.material,
      surface_treatment: item.surface_treatment,
      unit_price: item.unit_price || 0,
      customer_id: item.customer_id,
      customer_name: item.customers?.customer_name ?? null,
    };
  }

  const { data: bomRows, error: bomError } = await supabase
    .from('bom_items')
    .select(
      '*, parent_item:items!parent_item_id(id, customer_id, customers(customer_name))',
    )
    .ilike('drawing_no', trimmed);

  if (bomError) throw bomError;

  const bom = (bomRows ?? []).find((row) =>
    isDrawingMatch(row.drawing_no, trimmed),
  );
  if (!bom) return null;

  const parent = bom.parent_item as
    | (Pick<Item, 'id' | 'customer_id'> & {
        customers?: { customer_name: string } | null;
      })
    | null;

  return {
    source: 'bom',
    item_id: parent?.id ?? bom.parent_item_id,
    drawing_no: bom.drawing_no ?? trimmed,
    item_name: bom.item_name,
    material: bom.material,
    surface_treatment: bom.surface_treatment,
    unit_price: bom.unit_price || 0,
    customer_id: parent?.customer_id ?? null,
    customer_name: parent?.customers?.customer_name ?? null,
  };
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
