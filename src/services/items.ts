import { supabase } from '../lib/supabase';
import { getItemProductKind } from '../lib/itemProductKind';
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

export interface SinglePartLookupResult {
  drawing_no: string;
  item_name: string;
  material: string | null;
  surface_treatment: string | null;
  unit_price: number;
}

/** BOM 추가용 — 구분=단품 품목 이력만 조회 */
export async function lookupSinglePartByDrawingNo(
  drawingNo: string,
): Promise<SinglePartLookupResult | null> {
  const trimmed = drawingNo.trim();
  if (!trimmed) return null;

  const { data: itemRows, error } = await supabase
    .from('items')
    .select('*')
    .ilike('drawing_no', trimmed);

  if (error) throw error;

  const item = (itemRows ?? []).find(
    (row) =>
      isDrawingMatch(row.drawing_no, trimmed) &&
      getItemProductKind(row) === '단품',
  );
  if (!item) return null;

  return {
    drawing_no: item.drawing_no ?? trimmed,
    item_name: item.item_name,
    material: item.material,
    surface_treatment: item.surface_treatment,
    unit_price: item.unit_price || 0,
  };
}

/** 도번으로 BOM 행 조회 (있으면 2차 수주 단가 비교용) */
export async function lookupBomByDrawingNo(
  drawingNo: string,
): Promise<{ unit_price: number } | null> {
  const trimmed = drawingNo.trim();
  if (!trimmed) return null;

  const { data: bomRows, error } = await supabase
    .from('bom_items')
    .select('drawing_no, unit_price')
    .ilike('drawing_no', trimmed);

  if (error) throw error;

  const bom = (bomRows ?? []).find((row) =>
    isDrawingMatch(row.drawing_no, trimmed),
  );
  if (!bom) return null;

  const price = Number(bom.unit_price);
  return { unit_price: Number.isFinite(price) ? price : 0 };
}

export async function getStoredUnitPricesByDrawingNo(
  drawingNo: string,
): Promise<{ itemPrice: number | null; bomPrice: number | null }> {
  const trimmed = drawingNo.trim();
  if (!trimmed) return { itemPrice: null, bomPrice: null };

  let itemPrice: number | null = null;
  const { data: itemRows, error: itemError } = await supabase
    .from('items')
    .select('drawing_no, unit_price')
    .ilike('drawing_no', trimmed);

  if (itemError) throw itemError;
  const item = (itemRows ?? []).find((row) =>
    isDrawingMatch(row.drawing_no, trimmed),
  );
  if (item) {
    const p = Number(item.unit_price);
    itemPrice = Number.isFinite(p) ? p : null;
  }

  const bom = await lookupBomByDrawingNo(trimmed);
  const bomPrice = bom != null ? bom.unit_price : null;

  return { itemPrice, bomPrice };
}

/** BOM(bom_items) 등록 단가만 — 품목 마스터 fallback 없음 */
export async function getReferenceUnitPriceByDrawingNo(
  drawingNo: string,
): Promise<{ price: number; source: 'bom' } | null> {
  const bom = await lookupBomByDrawingNo(drawingNo.trim());
  if (bom != null && bom.unit_price > 0) {
    return { price: bom.unit_price, source: 'bom' };
  }
  return null;
}

/** 같은 도번 — 품목·BOM 단가 통일 */
export async function syncUnitPriceByDrawingNo(
  drawingNo: string,
  unitPrice: number,
  userEmail: string,
): Promise<void> {
  const trimmed = drawingNo.trim();
  if (!trimmed) return;

  const price = Number(unitPrice) || 0;

  const { data: itemRows, error: itemError } = await supabase
    .from('items')
    .select('id, drawing_no')
    .ilike('drawing_no', trimmed);

  if (itemError) throw itemError;

  for (const row of itemRows ?? []) {
    if (!isDrawingMatch(row.drawing_no, trimmed)) continue;
    const { error } = await supabase
      .from('items')
      .update({ unit_price: price, updated_by: userEmail })
      .eq('id', row.id);
    if (error) throw error;
  }

  const { data: bomRows, error: bomError } = await supabase
    .from('bom_items')
    .select('id, drawing_no')
    .ilike('drawing_no', trimmed);

  if (bomError) throw bomError;

  for (const row of bomRows ?? []) {
    if (!isDrawingMatch(row.drawing_no, trimmed)) continue;
    const { error } = await supabase
      .from('bom_items')
      .update({ unit_price: price, updated_by: userEmail })
      .eq('id', row.id);
    if (error) throw error;
  }
}

/** @deprecated — lookupBomByDrawingNo 사용 */
export async function getBomUnitPriceByDrawingNo(
  drawingNo: string,
): Promise<number | null> {
  const bom = await lookupBomByDrawingNo(drawingNo);
  if (!bom || bom.unit_price <= 0) return null;
  return bom.unit_price;
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

export async function findOrCreateItemByDrawingNo(params: {
  drawing_no: string;
  item_name: string;
  material?: string;
  surface_treatment?: string;
  customer_id?: string;
  unit_price?: number;
  userEmail: string;
}): Promise<string> {
  return upsertItemFromOrder(params);
}

export interface DrawingCandidate {
  drawing_no: string;
  item_name: string;
  material: string | null;
  surface_treatment: string | null;
  unit_price: number;
  item_id: string | null;
  source: 'item' | 'bom';
}

/** 도번 앞자리 — items·BOM 유사 검색 */
export async function searchDrawingCandidates(
  prefix: string,
  limit = 20,
): Promise<DrawingCandidate[]> {
  const term = prefix.trim();
  if (term.length < 2) return [];

  const pattern = `${term}%`;

  const [itemRes, bomRes] = await Promise.all([
    supabase
      .from('items')
      .select('id, drawing_no, item_name, material, surface_treatment, unit_price')
      .ilike('drawing_no', pattern)
      .limit(limit),
    supabase
      .from('bom_items')
      .select('drawing_no, item_name, material, surface_treatment, unit_price')
      .ilike('drawing_no', pattern)
      .limit(limit),
  ]);

  if (itemRes.error) throw itemRes.error;
  if (bomRes.error) throw bomRes.error;

  const map = new Map<string, DrawingCandidate>();

  for (const row of itemRes.data ?? []) {
    const dn = (row.drawing_no ?? '').trim();
    if (!dn) continue;
    const key = dn.toLowerCase();
    map.set(key, {
      drawing_no: dn,
      item_name: row.item_name,
      material: row.material,
      surface_treatment: row.surface_treatment,
      unit_price: Number(row.unit_price) || 0,
      item_id: row.id,
      source: 'item',
    });
  }

  for (const row of bomRes.data ?? []) {
    const dn = (row.drawing_no ?? '').trim();
    if (!dn) continue;
    const key = dn.toLowerCase();
    if (map.has(key)) continue;
    map.set(key, {
      drawing_no: dn,
      item_name: row.item_name,
      material: row.material,
      surface_treatment: row.surface_treatment,
      unit_price: Number(row.unit_price) || 0,
      item_id: null,
      source: 'bom',
    });
  }

  return [...map.values()]
    .sort((a, b) => a.drawing_no.localeCompare(b.drawing_no))
    .slice(0, limit);
}

/** 수주 저장 — items 마스터 upsert (단품). keepMasterUnitPrice=true면 기존 품목 단가 유지 */
export async function upsertItemFromOrder(params: {
  drawing_no: string;
  item_name: string;
  material?: string;
  surface_treatment?: string;
  customer_id?: string;
  unit_price?: number;
  userEmail: string;
  keepMasterUnitPrice?: boolean;
}): Promise<string> {
  const drawingNo = params.drawing_no.trim();
  if (!drawingNo) {
    throw new Error('도번이 필요합니다.');
  }

  const { data: itemRows, error: findError } = await supabase
    .from('items')
    .select('id, drawing_no')
    .ilike('drawing_no', drawingNo);

  if (findError) throw findError;

  const existing = (itemRows ?? []).find((row) =>
    isDrawingMatch(row.drawing_no, drawingNo),
  );

  const masterFields: Record<string, unknown> = {
    item_name: params.item_name,
    material: params.material ?? null,
    surface_treatment: params.surface_treatment ?? null,
    customer_id: params.customer_id ?? null,
    updated_by: params.userEmail,
  };

  if (existing) {
    const updatePayload = { ...masterFields };
    if (!params.keepMasterUnitPrice) {
      updatePayload.unit_price = params.unit_price ?? 0;
    }
    const { error } = await supabase
      .from('items')
      .update(updatePayload)
      .eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  }

  const insertUnitPrice =
    params.keepMasterUnitPrice ? 0 : (params.unit_price ?? 0);

  const { data: created, error: createError } = await supabase
    .from('items')
    .insert({
      drawing_no: drawingNo,
      ...masterFields,
      unit_price: insertUnitPrice,
      level: '단품',
      item_type: '가공품',
      quantity: 0,
      total_quantity: 0,
      created_by: params.userEmail,
    })
    .select('id')
    .single();

  if (createError) throw createError;
  return created.id;
}

/** 같은 도번 — 품목·BOM 필드 동기화 (단가 포함) */
export async function syncBomFieldsByDrawingNo(
  drawingNo: string,
  fields: {
    item_name: string;
    material?: string | null;
    surface_treatment?: string | null;
    unit_price?: number;
  },
  userEmail: string,
): Promise<void> {
  const trimmed = drawingNo.trim();
  if (!trimmed) return;

  const payload: Record<string, unknown> = {
    item_name: fields.item_name,
    material: fields.material ?? null,
    surface_treatment: fields.surface_treatment ?? null,
    updated_by: userEmail,
  };
  if (fields.unit_price !== undefined) {
    payload.unit_price = Number(fields.unit_price) || 0;
  }

  const { data: itemRows, error: itemError } = await supabase
    .from('items')
    .select('id, drawing_no')
    .ilike('drawing_no', trimmed);

  if (itemError) throw itemError;

  for (const row of itemRows ?? []) {
    if (!isDrawingMatch(row.drawing_no, trimmed)) continue;
    const { error } = await supabase
      .from('items')
      .update(payload)
      .eq('id', row.id);
    if (error) throw error;
  }

  const { data: bomRows, error: bomError } = await supabase
    .from('bom_items')
    .select('id, drawing_no')
    .ilike('drawing_no', trimmed);

  if (bomError) throw bomError;

  for (const row of bomRows ?? []) {
    if (!isDrawingMatch(row.drawing_no, trimmed)) continue;
    const { error } = await supabase
      .from('bom_items')
      .update(payload)
      .eq('id', row.id);
    if (error) throw error;
  }
}

