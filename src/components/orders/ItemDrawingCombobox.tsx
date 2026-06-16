import { useEffect, useRef, useState } from 'react';
import {
  searchDrawingCandidates,
  type DrawingCandidate,
} from '../../services/items';

interface ItemDrawingComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (candidate: DrawingCandidate) => void;
  onBlur?: (drawingNo: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function ItemDrawingCombobox({
  value,
  onChange,
  onSelect,
  onBlur,
  disabled,
  className = 'cell-input',
  placeholder = '도번',
}: ItemDrawingComboboxProps) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<DrawingCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const skipNextBlurLookup = useRef(false);

  useEffect(() => {
    const term = value.trim();
    if (term.length < 2) {
      setCandidates([]);
      return;
    }

    const timer = window.setTimeout(() => {
      setLoading(true);
      searchDrawingCandidates(term)
        .then((rows) => {
          setCandidates(rows);
          setOpen(rows.length > 0);
        })
        .catch(() => setCandidates([]))
        .finally(() => setLoading(false));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = (row: DrawingCandidate) => {
    skipNextBlurLookup.current = true;
    onSelect(row);
    setOpen(false);
  };

  return (
    <div className="item-drawing-combobox" ref={wrapRef}>
      <input
        type="text"
        className={className}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          if (e.target.value.trim().length >= 2) setOpen(true);
        }}
        onFocus={() => {
          if (candidates.length > 0) setOpen(true);
        }}
        onBlur={(e) => {
          const drawingNo = e.target.value;
          window.setTimeout(() => {
            setOpen(false);
            if (skipNextBlurLookup.current) {
              skipNextBlurLookup.current = false;
              return;
            }
            onBlur?.(drawingNo);
          }, 150);
        }}
        autoComplete="off"
      />
      {open && (candidates.length > 0 || loading) && (
        <ul className="item-drawing-dropdown" role="listbox">
          {loading && candidates.length === 0 && (
            <li className="item-drawing-option item-drawing-option--muted">
              검색 중…
            </li>
          )}
          {candidates.map((row) => (
            <li key={row.drawing_no}>
              <button
                type="button"
                className="item-drawing-option"
                role="option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(row)}
              >
                <span className="item-drawing-option-no">{row.drawing_no}</span>
                <span className="item-drawing-option-name">{row.item_name}</span>
                {row.material && (
                  <span className="item-drawing-option-meta">{row.material}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
