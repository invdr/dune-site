import { type ReactNode, useId } from 'react'

import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'

function RequiredMark() {
  return (
    <Typography as="span" aria-hidden>
      {' *'}
    </Typography>
  )
}

type BaseProps = {
  label: string
  description?: string
  error?: string
  required?: boolean
}

function errorList(error?: string) {
  return error ? [{ message: error }] : undefined
}

export function TextField({
  label,
  description,
  error,
  required,
  value,
  onChange,
  type = 'text',
  placeholder,
  inputMode,
}: BaseProps & {
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
}) {
  const id = useId()
  const errorId = useId()
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>
        {label}
        {required && <RequiredMark />}
      </FieldLabel>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError id={errorId} errors={errorList(error)} />
    </Field>
  )
}

export function TextareaField({
  label,
  description,
  error,
  value,
  onChange,
  rows = 4,
  placeholder,
}: BaseProps & {
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
}) {
  const id = useId()
  const errorId = useId()
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError id={errorId} errors={errorList(error)} />
    </Field>
  )
}

export function SelectField<T extends string>({
  label,
  description,
  error,
  required,
  value,
  onChange,
  options,
  disabled,
}: BaseProps & {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  disabled?: boolean
}) {
  const id = useId()
  const errorId = useId()
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>
        {label}
        {required && <RequiredMark />}
      </FieldLabel>
      <NativeSelect
        id={id}
        className="w-full"
        value={value}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError id={errorId} errors={errorList(error)} />
    </Field>
  )
}

// A boolean toggle laid out horizontally — for the premium/installment/new-build flags.
export function SwitchField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-input/20 px-4 py-3">
      <div className="grid gap-0.5">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

export function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(next) => onChange(next === true)}
      />
      <Typography as="span" variant="bodySm">
        {label}
      </Typography>
    </label>
  )
}

// Groups a labelled set of related fields with a heading.
export function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="grid gap-4 rounded-3xl border border-border bg-card p-5">
      <div className="grid gap-1">
        <Typography variant="h6">{title}</Typography>
        {description && (
          <Typography variant="bodySm" tone="muted">
            {description}
          </Typography>
        )}
      </div>
      {children}
    </section>
  )
}
