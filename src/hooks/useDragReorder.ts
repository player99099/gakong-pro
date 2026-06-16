import { useCallback, useState } from 'react';

export function useDragReorder(disabled = false) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const clearDrag = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  const rowClassName = useCallback(
    (index: number, baseClass = 'print-order-row') =>
      [
        baseClass,
        dragIndex === index ? `${baseClass}--dragging` : '',
        overIndex === index && dragIndex !== index ? `${baseClass}--drop-target` : '',
      ]
        .filter(Boolean)
        .join(' '),
    [dragIndex, overIndex],
  );

  const bindRow = useCallback(
    (index: number, onReorder: (from: number, to: number) => void) => ({
      className: rowClassName(index),
      draggable: !disabled,
      onDragStart: (e: React.DragEvent<HTMLTableRowElement>) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        setDragIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
      },
      onDragOver: (e: React.DragEvent<HTMLTableRowElement>) => {
        if (disabled || dragIndex == null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOverIndex(index);
      },
      onDrop: (e: React.DragEvent<HTMLTableRowElement>) => {
        e.preventDefault();
        if (disabled || dragIndex == null) return;
        onReorder(dragIndex, index);
        clearDrag();
      },
      onDragEnd: clearDrag,
    }),
    [disabled, dragIndex, rowClassName, clearDrag],
  );

  return { bindRow };
}
