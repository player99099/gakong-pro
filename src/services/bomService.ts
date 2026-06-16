import { supabase } from '../lib/supabase';
import { lookupBomByDrawingNo } from './items';

export async function createDefaultBomIfEmpty(params: {
  parent_item_id: string;
  drawing_no: string;
  item_name: string;
  material?: string;
  surface_treatment?: string;
  progress_place?: string;
  unit_price?: number;
  vendor_unit_price?: number;
  userEmail: string;
}): Promise<void> {
  const existingByDrawing = await lookupBomByDrawingNo(params.drawing_no);
  if (existingByDrawing != null) return;

  const { count, error: countError } = await supabase
    .from('bom_items')
    .select('id', { count: 'exact', head: true })
    .eq('parent_item_id', params.parent_item_id);

  if (countError) throw countError;
  if (count && count > 0) return;

  const { error } = await supabase.from('bom_items').insert({
    parent_item_id: params.parent_item_id,
    no: 1,
    level: '단품',
    drawing_no: params.drawing_no,
    item_name: params.item_name,
    material: params.material ?? null,
    surface_treatment: params.surface_treatment ?? null,
    item_type: '가공품',
    quantity: 0,
    total_quantity: 0,
    unit_price: params.unit_price ?? params.vendor_unit_price ?? 0,
    memo: params.progress_place
      ? `진행처: ${params.progress_place}`
      : null,
    created_by: params.userEmail,
    updated_by: params.userEmail,
  });

  if (error) throw error;
}
