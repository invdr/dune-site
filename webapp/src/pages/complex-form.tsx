import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { useState } from 'react'
import type { ComplexDto, CreateComplexRequest, PropertyStatus, UpdateComplexRequest } from '@dune/contracts'
import { createComplexSchema, updateComplexSchema } from '@dune/contracts'

import {
  FormSection,
  SelectField,
  SwitchField,
  TextareaField,
  TextField,
} from '@/components/admin/form-controls'
import { PhotoEditor, StringListEditor } from '@/components/admin/property-editors'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { propertyStatuses, statusLabels } from '@/lib/labels'
import { uploadFile } from '@/lib/upload'
import { useAuth } from '@/lib/use-auth'

type AttrRow = { label: string; value: string }

type Draft = {
  name: string
  slug: string
  status: PropertyStatus
  city: string
  district: string
  developer: string
  delivery: string
  description: string
  premium: boolean
  priceFrom: string
  areaFrom: string
  lat: string
  lng: string
  photos: string[]
  floorPlans: string[]
  badges: string[]
  features: string[]
  attributes: AttrRow[]
}

function toDraft(complex?: ComplexDto): Draft {
  return {
    name: complex?.name ?? '',
    slug: complex?.slug ?? '',
    status: complex?.status ?? 'DRAFT',
    city: complex?.city ?? 'Грозный',
    district: complex?.district ?? '',
    developer: complex?.developer ?? '',
    delivery: complex?.delivery ?? '',
    description: complex?.description ?? '',
    premium: complex?.premium ?? false,
    priceFrom: complex?.priceFrom != null ? String(complex.priceFrom) : '',
    areaFrom: complex?.areaFrom != null ? String(complex.areaFrom) : '',
    lat: complex?.lat != null ? String(complex.lat) : '',
    lng: complex?.lng != null ? String(complex.lng) : '',
    photos: complex?.photos ?? [],
    floorPlans: complex?.floorPlans ?? [],
    badges: complex?.badges ?? [],
    features: complex?.features ?? [],
    attributes: complex?.attributes ?? [],
  }
}

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

function buildPayload(draft: Draft) {
  return {
    name: draft.name.trim(),
    slug: draft.slug.trim(),
    status: draft.status,
    city: draft.city.trim(),
    district: draft.district.trim() || null,
    developer: draft.developer.trim() || null,
    delivery: draft.delivery.trim() || null,
    description: draft.description.trim() || null,
    premium: draft.premium,
    priceFrom: optionalNumber(draft.priceFrom) ?? null,
    areaFrom: optionalNumber(draft.areaFrom) ?? null,
    lat: optionalNumber(draft.lat) ?? null,
    lng: optionalNumber(draft.lng) ?? null,
    photos: draft.photos,
    floorPlans: draft.floorPlans,
    badges: draft.badges,
    features: draft.features,
    // Drop incomplete characteristic rows so we never persist half-filled pairs.
    attributes: draft.attributes
      .map((a) => ({ label: a.label.trim(), value: a.value.trim() }))
      .filter((a) => a.label && a.value),
  }
}

// Local label/value characteristics editor (no shared component exists yet).
function AttributeEditor({
  rows,
  onChange,
}: {
  rows: AttrRow[]
  onChange: (rows: AttrRow[]) => void
}) {
  function update(index: number, patch: Partial<AttrRow>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }
  return (
    <div className="grid gap-2">
      <FieldLabel>Характеристики</FieldLabel>
      <FieldDescription>Пары «свойство — значение», например «Класс — Бизнес».</FieldDescription>
      <div className="grid gap-2">
        {rows.map((row, index) => (
          <div key={index} className="flex gap-2">
            <Input
              placeholder="Свойство"
              value={row.label}
              onChange={(event) => update(index, { label: event.target.value })}
            />
            <Input
              placeholder="Значение"
              value={row.value}
              onChange={(event) => update(index, { value: event.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Удалить строку"
              className="text-destructive"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start gap-2"
        onClick={() => onChange([...rows, { label: '', value: '' }])}
      >
        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
        Добавить характеристику
      </Button>
    </div>
  )
}

export function ComplexForm({
  complex,
  isSaving,
  onSubmit,
}: {
  complex?: ComplexDto
  isSaving: boolean
  onSubmit: (payload: CreateComplexRequest | UpdateComplexRequest) => Promise<void>
}) {
  const { api } = useAuth()
  const [draft, setDraft] = useState<Draft>(() => toDraft(complex))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const isEdit = Boolean(complex)

  function update(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setErrors({})
    setFormError(null)

    const schema = isEdit ? updateComplexSchema : createComplexSchema
    const result = schema.safeParse(buildPayload(draft))
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? 'form')
        fieldErrors[key] ??= issue.message
      }
      setErrors(fieldErrors)
      setFormError('Проверьте поля формы — есть ошибки.')
      return
    }

    try {
      await onSubmit(result.data)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Не удалось сохранить ЖК.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      {formError && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <FormSection title="Основное" description="Название, адрес в URL и публикация.">
        <TextField
          label="Название ЖК"
          required
          value={draft.name}
          error={errors.name}
          placeholder="ЖК Ан Нур"
          onChange={(value) => update({ name: value })}
        />
        <TextField
          label="Slug (адрес в URL)"
          required
          value={draft.slug}
          error={errors.slug}
          description="Латиница, например zhk-an-nur. Должен совпадать у всех страниц этого ЖК."
          onChange={(value) => update({ slug: value })}
        />
        <SelectField
          label="Статус"
          value={draft.status}
          error={errors.status}
          onChange={(value) => update({ status: value })}
          options={propertyStatuses.map((value) => ({ value, label: statusLabels[value] }))}
        />
        <SwitchField
          label="Рекомендуемый"
          description="Показывать значок «Рекомендуем» и поднимать в каталоге."
          checked={draft.premium}
          onChange={(checked) => update({ premium: checked })}
        />
      </FormSection>

      <FormSection title="Локация и застройщик">
        <TextField
          label="Город"
          required
          value={draft.city}
          error={errors.city}
          onChange={(value) => update({ city: value })}
        />
        <TextField
          label="Район"
          value={draft.district}
          error={errors.district}
          onChange={(value) => update({ district: value })}
        />
        <TextField
          label="Застройщик"
          value={draft.developer}
          error={errors.developer}
          onChange={(value) => update({ developer: value })}
        />
        <TextField
          label="Срок сдачи"
          value={draft.delivery}
          error={errors.delivery}
          placeholder="IV кв. 2026 / Сдан"
          onChange={(value) => update({ delivery: value })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Широта (lat)"
            value={draft.lat}
            error={errors.lat}
            inputMode="decimal"
            onChange={(value) => update({ lat: value })}
          />
          <TextField
            label="Долгота (lng)"
            value={draft.lng}
            error={errors.lng}
            inputMode="decimal"
            onChange={(value) => update({ lng: value })}
          />
        </div>
      </FormSection>

      <FormSection
        title="Цена и площадь"
        description="Используются, если у ЖК нет привязанных квартир. При наличии квартир «от» считается по ним автоматически."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Цена от, ₽/м²"
            value={draft.priceFrom}
            error={errors.priceFrom}
            inputMode="numeric"
            onChange={(value) => update({ priceFrom: value })}
          />
          <TextField
            label="Площадь от, м²"
            value={draft.areaFrom}
            error={errors.areaFrom}
            inputMode="numeric"
            onChange={(value) => update({ areaFrom: value })}
          />
        </div>
      </FormSection>

      <FormSection title="Контент" description="Фото, описание и характеристики комплекса.">
        <PhotoEditor
          values={draft.photos}
          onChange={(photos) => update({ photos })}
          onUpload={(file) => uploadFile(api, file, 'properties')}
        />
        <PhotoEditor
          label="Планировки"
          description="Изображения планировок — показываются отдельным блоком на странице ЖК."
          values={draft.floorPlans}
          onChange={(floorPlans) => update({ floorPlans })}
          onUpload={(file) => uploadFile(api, file, 'properties')}
        />
        <TextareaField
          label="Описание"
          rows={6}
          value={draft.description}
          error={errors.description}
          onChange={(value) => update({ description: value })}
        />
        <AttributeEditor rows={draft.attributes} onChange={(attributes) => update({ attributes })} />
        <StringListEditor
          label="Бейджи"
          description="Короткие метки на карточке, например «Бизнес-класс»."
          values={draft.badges}
          onChange={(badges) => update({ badges })}
        />
        <StringListEditor
          label="Особенности"
          description="Список преимуществ на странице ЖК."
          values={draft.features}
          onChange={(features) => update({ features })}
        />
      </FormSection>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </div>
    </form>
  )
}
