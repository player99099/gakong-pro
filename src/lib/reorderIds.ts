export function reorderIds(ids: string[], fromIndex: number, toIndex: number): string[] {
  if (fromIndex === toIndex) return ids;
  const next = [...ids];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next;
}

/** 목록 새로고침 시 기존 사용자 순서를 유지하고 신규 id만 뒤에 추가 */
export function mergeDisplayOrder(existingOrder: string[], fetchedIds: string[]): string[] {
  const fetchedSet = new Set(fetchedIds);
  const kept = existingOrder.filter((id) => fetchedSet.has(id));
  const keptSet = new Set(kept);
  const appended = fetchedIds.filter((id) => !keptSet.has(id));
  return [...kept, ...appended];
}

export function sortByIdOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const result: T[] = [];
  const used = new Set<string>();

  for (const id of order) {
    const item = byId.get(id);
    if (item) {
      result.push(item);
      used.add(id);
    }
  }

  for (const item of items) {
    if (!used.has(item.id)) result.push(item);
  }

  return result;
}

/** displayOrder 기준으로 선택 id 순서 정렬 */
export function sortSelectedByDisplayOrder(displayOrder: string[], selected: string[]): string[] {
  const selectedSet = new Set(selected);
  return displayOrder.filter((id) => selectedSet.has(id));
}

/** 모달에서 바꾼 선택 순서를 displayOrder에 반영 */
export function mergeSelectedOrderIntoDisplay(
  displayOrder: string[],
  selectedOrder: string[],
): string[] {
  const selectedSet = new Set(selectedOrder);
  if (selectedSet.size === 0) return displayOrder;

  const withoutSelected = displayOrder.filter((id) => !selectedSet.has(id));
  const firstSelectedIndex = displayOrder.findIndex((id) => selectedSet.has(id));
  const insertAt =
    firstSelectedIndex === -1
      ? withoutSelected.length
      : displayOrder.slice(0, firstSelectedIndex).filter((id) => !selectedSet.has(id)).length;

  const next = [...withoutSelected];
  next.splice(insertAt, 0, ...selectedOrder);
  return next;
}
