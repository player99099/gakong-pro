import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'default' | 'lg';
  busyOverlay?: ReactNode;
  resizable?: boolean;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
  stackLayer?: 'default' | 'top';
}

function centerWindow(width: number, height: number) {
  const margin = 20;
  return {
    x: Math.max(margin, (window.innerWidth - width) / 2),
    y: Math.max(margin, (window.innerHeight - height) / 2),
  };
}

export function Modal({
  title,
  open,
  onClose,
  children,
  footer,
  size = 'default',
  busyOverlay,
  resizable = false,
  initialWidth = 920,
  initialHeight = 560,
  minWidth = 560,
  minHeight = 320,
  stackLayer = 'default',
}: ModalProps) {
  const overlayDownOnBackdrop = useRef(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const resizeStart = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [windowSize, setWindowSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setPos(null);
      setWindowSize(null);
      return;
    }
    if (resizable) {
      setWindowSize({ width: initialWidth, height: initialHeight });
      setPos(centerWindow(initialWidth, initialHeight));
    }
  }, [open, resizable, initialWidth, initialHeight]);

  useEffect(() => {
    if (!open) return;

    const onMove = (e: MouseEvent) => {
      if (resizeStart.current) {
        const dx = e.clientX - resizeStart.current.x;
        const dy = e.clientY - resizeStart.current.y;
        const maxW = window.innerWidth - (pos?.x ?? 20) - 12;
        const maxH = window.innerHeight - (pos?.y ?? 20) - 12;
        setWindowSize({
          width: Math.min(
            maxW,
            Math.max(minWidth, resizeStart.current.width + dx),
          ),
          height: Math.min(
            maxH,
            Math.max(minHeight, resizeStart.current.height + dy),
          ),
        });
        return;
      }

      if (!dragStart.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPos({
        x: dragStart.current.left + dx,
        y: dragStart.current.top + dy,
      });
    };

    const onUp = () => {
      dragStart.current = null;
      resizeStart.current = null;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [open, minWidth, minHeight, pos?.x, pos?.y]);

  if (!open) return null;

  const handleOverlayMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) overlayDownOnBackdrop.current = true;
  };

  const handleOverlayMouseUp = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && overlayDownOnBackdrop.current) {
      onClose();
    }
    overlayDownOnBackdrop.current = false;
  };

  const handleHeaderMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.modal-close')) return;
    const el = modalRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      left: rect.left,
      top: rect.top,
    };
    e.preventDefault();
  };

  const handleResizeMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = modalRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: rect.width,
      height: rect.height,
    };
  };

  const isWindow = resizable && pos && windowSize;

  const modalStyle = isWindow
    ? {
        position: 'fixed' as const,
        left: pos.x,
        top: pos.y,
        width: windowSize.width,
        height: windowSize.height,
        margin: 0,
        transform: 'none',
      }
    : pos
      ? {
          position: 'fixed' as const,
          left: pos.x,
          top: pos.y,
          margin: 0,
          transform: 'none',
        }
      : undefined;

  const overlayClass = [
    resizable ? 'modal-overlay modal-overlay--window' : 'modal-overlay',
    stackLayer === 'top' ? 'modal-overlay--top' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const modalClass = [
    'modal',
    size === 'lg' ? 'modal-lg' : '',
    pos ? 'modal--dragged' : '',
    resizable ? 'modal--window' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={overlayClass}
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
    >
      <div
        ref={modalRef}
        className={modalClass}
        style={modalStyle}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {busyOverlay}
        <div
          className="modal-header modal-drag-handle"
          onMouseDown={handleHeaderMouseDown}
        >
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} type="button">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
        {resizable && (
          <div
            className="modal-resize-handle"
            onMouseDown={handleResizeMouseDown}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}
