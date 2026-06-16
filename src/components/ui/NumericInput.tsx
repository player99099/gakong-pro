import { useState, type InputHTMLAttributes } from 'react';
import { formatNumber, parseFormattedNumber } from '../../lib/formatNumber';

type NumericInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'inputMode'
> & {
  value: number;
  onChange: (value: number) => void;
  onValueBlur?: (value: number) => void;
};

export function NumericInput({
  value,
  onChange,
  onValueBlur,
  className,
  disabled,
  onFocus,
  onBlur,
  ...rest
}: NumericInputProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');

  const displayValue = focused
    ? draft
    : formatNumber(value);

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      className={className}
      disabled={disabled}
      value={displayValue}
      onFocus={(e) => {
        setFocused(true);
        const n = Number(value);
        setDraft(Number.isFinite(n) && n !== 0 ? String(n) : '');
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        const n = parseFormattedNumber(draft);
        onChange(n);
        onValueBlur?.(n);
        onBlur?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.-]/g, '');
        setDraft(raw);
        onChange(parseFormattedNumber(raw));
      }}
    />
  );
}
