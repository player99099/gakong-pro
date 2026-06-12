import type { Customer } from '../../types';

interface CustomerComboboxProps {
  id?: string;
  label?: string;
  value: string;
  customers: Customer[];
  onChange: (name: string) => void;
  required?: boolean;
  placeholder?: string;
}

export function CustomerCombobox({
  id = 'customer-combobox',
  label = '고객사',
  value,
  customers,
  onChange,
  required = false,
  placeholder = '고객사명 입력 또는 선택',
}: CustomerComboboxProps) {
  const listId = `${id}-list`;

  return (
    <div className="form-group">
      <label htmlFor={id}>
        {label}
        {required && <span className="required"> *</span>}
      </label>
      <input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <datalist id={listId}>
        {customers.map((c) => (
          <option key={c.id} value={c.customer_name} />
        ))}
      </datalist>
    </div>
  );
}
