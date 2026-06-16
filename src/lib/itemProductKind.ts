import type { ItemProductKind } from './constants';
import type { Item } from '../types';

export function getItemProductKind(
  item: Pick<Item, 'level' | 'item_type'>,
): ItemProductKind {
  const level = item.level?.trim();
  if (level === '단품') return '단품';
  if (level === "Ass'y" || level === 'ASSY') return "Ass'y";
  if (item.item_type === '단품') return '단품';
  if (item.item_type === 'ASSY') return "Ass'y";
  return '단품';
}

export function isAssyItem(item: Pick<Item, 'level' | 'item_type'>): boolean {
  return getItemProductKind(item) === "Ass'y";
}
