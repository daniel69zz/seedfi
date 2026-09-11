import { ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import './Select.css'

export interface SelectOption<Value extends string> {
  value: Value
  label: string
}

interface SelectProps<Value extends string> {
  label: string
  value: Value
  onChange: (value: Value) => void
  options: readonly SelectOption<Value>[]
  icon: LucideIcon
  className?: string
}

export function Select<Value extends string>({
  label,
  value,
  onChange,
  options,
  icon: Icon,
  className = '',
}: SelectProps<Value>) {
  return (
    <label className={`select-control ${className}`}>
      <Icon className="select-control__icon" aria-hidden="true" strokeWidth={2.7} />
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as Value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="select-control__chevron" aria-hidden="true" strokeWidth={3} />
    </label>
  )
}
