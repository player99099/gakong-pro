import { useCallback, useRef, type CSSProperties } from 'react';
import type { PrintContext, PrintElement, PrintLayout } from '../../types/printTemplate';
import { resolveBindValue } from '../../lib/print/resolveBindValue';

const MM_TO_PX = 3.7795275591;

export function mmToPx(mm: number): number {
  return mm * MM_TO_PX;
}

function elementStyle(el: PrintElement): CSSProperties {
  const s = el.style ?? {};
  const border =
    el.type === 'line'
      ? `${s.borderWidth ?? 1}px ${s.borderStyle ?? 'solid'} #000`
      : s.borderWidth
        ? `${s.borderWidth}px ${s.borderStyle ?? 'solid'} #000`
        : undefined;

  return {
    position: 'absolute',
    left: `${el.x}mm`,
    top: `${el.y}mm`,
    width: `${el.w}mm`,
    height: `${el.h}mm`,
    fontSize: s.fontSize ? `${s.fontSize}pt` : '9pt',
    fontWeight: s.fontWeight ?? 'normal',
    textAlign: s.textAlign ?? 'left',
    display: 'flex',
    alignItems:
      s.verticalAlign === 'middle'
        ? 'center'
        : s.verticalAlign === 'bottom'
          ? 'flex-end'
          : 'flex-start',
    justifyContent:
      s.textAlign === 'center'
        ? 'center'
        : s.textAlign === 'right'
          ? 'flex-end'
          : 'flex-start',
    border,
    background: s.background,
    color: s.color,
    padding: s.paddingMm ? `${s.paddingMm}mm` : undefined,
    boxSizing: 'border-box',
    overflow: 'hidden',
    lineHeight: 1.2,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };
}

interface PrintElementViewProps {
  element: PrintElement;
  context: PrintContext;
  editMode?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onMove?: (id: string, x: number, y: number) => void;
}

function PrintElementView({
  element,
  context,
  editMode,
  selected,
  onSelect,
  onMove,
}: PrintElementViewProps) {
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null,
  );

  const displayText =
    element.type === 'bind' && element.bindKey
      ? resolveBindValue(element.bindKey, context)
      : element.text ?? '';

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!editMode || !onSelect) return;
    e.stopPropagation();
    onSelect(element.id);
    if (!onMove) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: element.x,
      origY: element.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !onMove) return;
    const dx = (e.clientX - dragRef.current.startX) / MM_TO_PX;
    const dy = (e.clientY - dragRef.current.startY) / MM_TO_PX;
    onMove(element.id, Math.max(0, dragRef.current.origX + dx), Math.max(0, dragRef.current.origY + dy));
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  if (element.type === 'checkbox') {
    return (
      <div
        className={`print-el print-el--checkbox ${selected ? 'print-el--selected' : ''}`}
        style={elementStyle(element)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <span className="print-checkbox-box" />
        {element.text && <span className="print-checkbox-label">{element.text}</span>}
      </div>
    );
  }

  if (element.type === 'line') {
    const isHorizontal = element.w >= element.h;
    return (
      <div
        className={`print-el print-el--line ${selected ? 'print-el--selected' : ''}`}
        style={{
          ...elementStyle(element),
          border: 'none',
          borderTop: isHorizontal ? '1px solid #000' : undefined,
          borderLeft: !isHorizontal ? '1px solid #000' : undefined,
          height: isHorizontal ? 0 : `${element.h}mm`,
          width: isHorizontal ? `${element.w}mm` : 0,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
    );
  }

  return (
    <div
      className={`print-el print-el--${element.type} ${selected ? 'print-el--selected' : ''}`}
      style={elementStyle(element)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {element.type !== 'box' && displayText}
    </div>
  );
}

export interface PrintCanvasProps {
  layout: PrintLayout;
  context: PrintContext;
  scale?: number;
  editMode?: boolean;
  selectedElementId?: string | null;
  onSelectElement?: (id: string | null) => void;
  onElementMove?: (pageId: string, elementId: string, x: number, y: number) => void;
  className?: string;
}

export function PrintCanvas({
  layout,
  context,
  scale = 1,
  editMode = false,
  selectedElementId,
  onSelectElement,
  onElementMove,
  className = '',
}: PrintCanvasProps) {
  const handlePageClick = useCallback(() => {
    if (editMode) onSelectElement?.(null);
  }, [editMode, onSelectElement]);

  return (
    <div
      className={`print-canvas-root ${className}`.trim()}
      style={{ transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: 'top center' }}
    >
      {layout.pages.map((page) => (
        <div
          key={page.id}
          className={`print-page print-page--${page.orientation}`}
          data-page-name={page.name}
          style={{
            width: `${page.widthMm}mm`,
            height: `${page.heightMm}mm`,
          }}
          onClick={handlePageClick}
        >
          {page.elements.map((el) => (
            <PrintElementView
              key={el.id}
              element={el}
              context={context}
              editMode={editMode}
              selected={selectedElementId === el.id}
              onSelect={(id) => onSelectElement?.(id)}
              onMove={
                onElementMove
                  ? (id, x, y) => onElementMove(page.id, id, x, y)
                  : undefined
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}
