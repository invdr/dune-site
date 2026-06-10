import {
  createPropertySchema,
  updatePropertySchema,
  type CommercialKind,
  type CreatePropertyRequest,
  type LandUse,
  type PropertyDirection,
  type PropertyDto,
  type PropertyStatus,
  type PropertyType,
  type UpdatePropertyRequest,
  type Utility,
} from '@dune/contracts'
import { useState } from 'react'

import {
  CheckboxField,
  FormSection,
  SelectField,
  SwitchField,
  TextField,
} from '@/components/admin/form-controls'
import {
  CoordinatePicker,
  PhotoEditor,
  StringListEditor,
} from '@/components/admin/property-editors'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import {
  commercialKindLabels,
  commercialKinds,
  currencyLabels,
  defaultCurrencyForDirection,
  directionLabels,
  directions,
  landUseLabels,
  landUses,
  propertyStatuses,
  propertyTypes,
  statusLabels,
  typeLabels,
  utilities as utilityValues,
  utilityLabels,
} from '@/lib/labels'
import { uploadFile } from '@/lib/upload'
import { useAuth } from '@/lib/use-auth'

type Draft = {
  slug: string
  title: string
  direction: PropertyDirection
  type: PropertyType
  status: PropertyStatus
  rooms: string
  area: string
  floor: string
  totalFloors: string
  complex: string
  city: string
  district: string
  price: string
  delivery: string
  placeholderTone: string
  premium: boolean
  installment: boolean
  isNewBuilding: boolean
  photos: string[]
  badges: string[]
  features: string[]
  landUse: '' | LandUse
  commercialKind: '' | CommercialKind
  utilities: Utility[]
  lat: string
  lng: string
  managerName: string
  managerPhone: string
  managerPhotoUrl: string
}

const residentialTypes: PropertyType[] = ['APARTMENT', 'HOUSE', 'TOWNHOUSE']

function numOr(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function intOrNull(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function floatOrNull(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function requiredInt(value: string): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function toDraft(property?: PropertyDto): Draft {
  return {
    slug: property?.slug ?? '',
    title: property?.title ?? '',
    direction: property?.direction ?? 'NEW',
    type: property?.type ?? 'APARTMENT',
    status: property?.status ?? 'DRAFT',
    rooms: property ? String(property.rooms) : '0',
    area: property ? String(property.area) : '',
    floor: property?.floor != null ? String(property.floor) : '',
    totalFloors: property?.totalFloors != null ? String(property.totalFloors) : '',
    complex: property?.complex ?? '',
    city: property?.city ?? '',
    district: property?.district ?? '',
    price: property ? String(property.price) : '',
    delivery: property?.delivery ?? '',
    placeholderTone: property?.placeholderTone ?? '',
    premium: property?.premium ?? false,
    installment: property?.installment ?? false,
    isNewBuilding: property?.isNewBuilding ?? false,
    photos: property?.photos ?? [],
    badges: property?.badges ?? [],
    features: property?.features ?? [],
    landUse: property?.landUse ?? '',
    commercialKind: property?.commercialKind ?? '',
    utilities: property?.utilities ?? [],
    lat: property?.lat != null ? String(property.lat) : '',
    lng: property?.lng != null ? String(property.lng) : '',
    managerName: property?.managerName ?? '',
    managerPhone: property?.managerPhone ?? '',
    managerPhotoUrl: property?.managerPhotoUrl ?? '',
  }
}

// Site-authored objects expose the full writable surface. `source` is omitted:
// provenance is fixed at creation, so the editor can never rewrite it (this is
// what protected QuickDeal mirrors from being silently detached from sync).
// Currency is derived from direction (§5), never free-typed.
function toWritable(draft: Draft) {
  return {
    slug: draft.slug.trim(),
    title: draft.title,
    direction: draft.direction,
    type: draft.type,
    status: draft.status,
    currency: defaultCurrencyForDirection(draft.direction),
    rooms: numOr(draft.rooms, 0),
    area: requiredInt(draft.area),
    floor: intOrNull(draft.floor),
    totalFloors: intOrNull(draft.totalFloors),
    complex: draft.complex,
    city: draft.city,
    district: draft.district,
    price: numOr(draft.price, 0),
    delivery: draft.delivery,
    placeholderTone: draft.placeholderTone,
    premium: draft.premium,
    installment: draft.installment,
    isNewBuilding: draft.isNewBuilding,
    photos: draft.photos,
    badges: draft.badges,
    features: draft.features,
    lat: floatOrNull(draft.lat),
    lng: floatOrNull(draft.lng),
    landUse: draft.landUse === '' ? undefined : draft.landUse,
    commercialKind: draft.commercialKind === '' ? undefined : draft.commercialKind,
    utilities: draft.utilities,
    managerName: draft.managerName,
    managerPhone: draft.managerPhone,
    managerPhotoUrl: draft.managerPhotoUrl,
  }
}

// QuickDeal-mirrored objects are a strict mirror: only the site layer is
// editable here. Every other column is feed-owned and would be overwritten by
// the next hourly sync, so we never send it (see "Решения обсуждения", §2.4).
function toSiteLayer(draft: Draft): UpdatePropertyRequest {
  return {
    slug: draft.slug.trim(),
    badges: draft.badges,
    features: draft.features,
    premium: draft.premium,
    placeholderTone: draft.placeholderTone,
  }
}

const siteLayerFields = ['slug', 'badges', 'features', 'premium', 'placeholderTone']

// The editable site layer, shared shape for mirrored objects. Site-authored
// objects edit these inline in the full form instead.
function SiteLayerSections({
  draft,
  errors,
  update,
}: {
  draft: Draft
  errors: Record<string, string>
  update: (patch: Partial<Draft>) => void
}) {
  return (
    <FormSection
      title="Сайтовый слой"
      description="Эти поля редактируются на сайте и переживают синхронизацию с QuickDeal."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Slug (URL)"
          required
          value={draft.slug}
          error={errors.slug}
          description="Только строчные латинские буквы, цифры и дефис."
          onChange={(value) => update({ slug: value })}
        />
        <TextField
          label="Тон плейсхолдера"
          value={draft.placeholderTone}
          error={errors.placeholderTone}
          description="Оттенок брендового плейсхолдера, если фото нет."
          onChange={(value) => update({ placeholderTone: value })}
        />
      </div>
      <SwitchField
        label="Премиум"
        description="Премиум-кураторство объекта."
        checked={draft.premium}
        onChange={(checked) => update({ premium: checked })}
      />
      <StringListEditor
        label="Бейджи"
        description="Короткие метки на карточке (напр. «Вид на море»)."
        values={draft.badges}
        onChange={(badges) => update({ badges })}
        placeholder="Добавить бейдж"
      />
      <StringListEditor
        label="Что входит (features)"
        values={draft.features}
        onChange={(features) => update({ features })}
        placeholder="Добавить пункт"
      />
    </FormSection>
  )
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <Typography as="span" variant="bodyXs" tone="muted">
        {label}
      </Typography>
      <Typography as="span" variant="bodySm">
        {value}
      </Typography>
    </div>
  )
}

export function PropertyForm({
  property,
  isSaving,
  onSubmit,
}: {
  property?: PropertyDto
  isSaving: boolean
  onSubmit: (payload: CreatePropertyRequest | UpdatePropertyRequest) => Promise<void>
}) {
  const { api } = useAuth()
  const [draft, setDraft] = useState<Draft>(() => toDraft(property))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const isEdit = Boolean(property)
  const isMirrored = property?.source === 'QUICKDEAL'
  const isResidential = residentialTypes.includes(draft.type)
  const isLand = draft.type === 'LAND'
  const isCommercial = draft.type === 'COMMERCIAL'
  // Feed-owned fields are read-only for mirrored objects; only the site layer
  // (slug/badges/features/premium/placeholderTone) stays editable.
  const feedLocked = isMirrored
  const currency = defaultCurrencyForDirection(draft.direction)

  function update(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function changeType(type: PropertyType) {
    // Drop type-specific values when leaving their type so an apartment can't
    // keep a stale landUse/utilities/commercialKind the backend would accept.
    update({
      type,
      landUse: type === 'LAND' ? draft.landUse : '',
      utilities: type === 'LAND' ? draft.utilities : [],
      commercialKind: type === 'COMMERCIAL' ? draft.commercialKind : '',
    })
  }

  function toggleUtility(utility: Utility, checked: boolean) {
    update({
      utilities: checked
        ? [...draft.utilities, utility]
        : draft.utilities.filter((item) => item !== utility),
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)

    // Mirrored edit → site layer only. Site/new → full writable set.
    const result = isMirrored
      ? updatePropertySchema.safeParse(toSiteLayer(draft))
      : isEdit
        ? updatePropertySchema.safeParse(toWritable(draft))
        : createPropertySchema.safeParse(toWritable(draft))

    if (!result.success) {
      const nextErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? '')
        if (key && !nextErrors[key]) nextErrors[key] = issue.message
      }
      setErrors(nextErrors)
      // Site-layer fields a mirrored editor can't see shouldn't read as "hidden".
      const visibleError = isMirrored
        ? siteLayerFields.some((field) => nextErrors[field])
        : true
      setFormError(visibleError ? 'Проверьте выделенные поля.' : 'Не удалось сохранить объект.')
      return
    }
    setErrors({})
    try {
      await onSubmit(result.data)
    } catch (caughtError) {
      setFormError(caughtError instanceof Error ? caughtError.message : 'Не удалось сохранить объект')
    }
  }

  // Mirrored objects render a read-only feed summary plus the editable site
  // layer only — there is no way to touch (or accidentally submit) feed fields.
  if (feedLocked && property) {
    return (
      <form onSubmit={handleSubmit} className="grid gap-5">
        <Alert>
          <AlertTitle>Объект из QuickDeal</AlertTitle>
          <AlertDescription>
            Карточка — зеркало фида. Поля ниже приходят из QuickDeal и обновляются синхронизацией;
            редактировать можно только сайтовый слой.
          </AlertDescription>
        </Alert>

        <FormSection title="Из фида (только чтение)">
          <dl className="grid gap-3 sm:grid-cols-2">
            <ReadOnlyRow label="Заголовок" value={property.title} />
            <ReadOnlyRow label="Направление" value={directionLabels[property.direction]} />
            <ReadOnlyRow label="Тип" value={typeLabels[property.type]} />
            <ReadOnlyRow label="Статус" value={statusLabels[property.status]} />
            <ReadOnlyRow label="Город" value={property.city} />
            <ReadOnlyRow
              label="Цена"
              value={
                property.price > 0
                  ? `${property.price.toLocaleString('ru-RU')} ${property.currency === 'USD' ? '$' : '₽'}`
                  : 'по запросу'
              }
            />
          </dl>
        </FormSection>

        <SiteLayerSections draft={draft} errors={errors} update={update} />

        {formError && (
          <Alert variant="destructive">
            <AlertTitle>Не сохранено</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-background/95 py-4 backdrop-blur">
          <Button type="submit" size="lg" disabled={isSaving}>
            {isSaving ? 'Сохранение…' : 'Сохранить сайтовый слой'}
          </Button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <FormSection title="Основное">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Заголовок"
            required
            value={draft.title}
            error={errors.title}
            onChange={(value) => update({ title: value })}
          />
          <TextField
            label="Slug (URL)"
            required
            value={draft.slug}
            error={errors.slug}
            description="Только строчные латинские буквы, цифры и дефис."
            onChange={(value) => update({ slug: value })}
          />
          <SelectField
            label="Направление"
            required
            value={draft.direction}
            error={errors.direction}
            onChange={(value) => update({ direction: value })}
            options={directions.map((value) => ({ value, label: directionLabels[value] }))}
          />
          <SelectField
            label="Тип"
            required
            value={draft.type}
            error={errors.type}
            onChange={changeType}
            options={propertyTypes.map((value) => ({ value, label: typeLabels[value] }))}
          />
          <SelectField
            label="Статус публикации"
            required
            value={draft.status}
            error={errors.status}
            onChange={(value) => update({ status: value })}
            options={propertyStatuses.map((value) => ({ value, label: statusLabels[value] }))}
          />
        </div>
      </FormSection>

      <FormSection title="Расположение">
        <div className="grid gap-4 sm:grid-cols-2">
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
            label="Комплекс / проект"
            value={draft.complex}
            error={errors.complex}
            onChange={(value) => update({ complex: value })}
          />
        </div>
      </FormSection>

      <FormSection title="Цена">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={`Цена, ${currency === 'USD' ? '$' : '₽'}`}
            required
            inputMode="numeric"
            value={draft.price}
            error={errors.price}
            description="0 — отображается как «Цена по запросу»."
            onChange={(value) => update({ price: value })}
          />
          <div className="grid gap-1.5">
            <Typography as="span" variant="label">
              Валюта
            </Typography>
            <Typography variant="bodySm" tone="muted">
              {currencyLabels[currency]} — определяется направлением (§5).
            </Typography>
          </div>
        </div>
      </FormSection>

      <FormSection title="Характеристики">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={isLand ? 'Площадь, м²' : 'Площадь, м²'}
            required
            inputMode="numeric"
            value={draft.area}
            error={errors.area}
            onChange={(value) => update({ area: value })}
          />
          {isResidential && (
            <TextField
              label="Комнат (0 — студия)"
              inputMode="numeric"
              value={draft.rooms}
              error={errors.rooms}
              onChange={(value) => update({ rooms: value })}
            />
          )}
          {(isResidential || isCommercial) && (
            <>
              <TextField
                label="Этаж"
                inputMode="numeric"
                value={draft.floor}
                error={errors.floor}
                onChange={(value) => update({ floor: value })}
              />
              <TextField
                label="Этажность"
                inputMode="numeric"
                value={draft.totalFloors}
                error={errors.totalFloors}
                onChange={(value) => update({ totalFloors: value })}
              />
            </>
          )}
          {(isResidential || draft.isNewBuilding) && (
            <TextField
              label="Срок сдачи"
              value={draft.delivery}
              error={errors.delivery}
              placeholder="напр. IV кв. 2026"
              onChange={(value) => update({ delivery: value })}
            />
          )}
          {isCommercial && (
            <SelectField
              label="Вид помещения"
              value={draft.commercialKind || ''}
              error={errors.commercialKind}
              onChange={(value) => update({ commercialKind: value as '' | CommercialKind })}
              options={[
                { value: '' as const, label: '—' },
                ...commercialKinds.map((value) => ({ value, label: commercialKindLabels[value] })),
              ]}
            />
          )}
          {isLand && (
            <SelectField
              label="Назначение земли"
              value={draft.landUse || ''}
              error={errors.landUse}
              onChange={(value) => update({ landUse: value as '' | LandUse })}
              options={[
                { value: '' as const, label: '—' },
                ...landUses.map((value) => ({ value, label: landUseLabels[value] })),
              ]}
            />
          )}
        </div>

        {isLand && (
          <div className="grid gap-2">
            <Typography as="span" variant="bodySmMedium">
              Коммуникации
            </Typography>
            <div className="flex flex-wrap gap-4">
              {utilityValues.map((utility) => (
                <CheckboxField
                  key={utility}
                  label={utilityLabels[utility]}
                  checked={draft.utilities.includes(utility)}
                  onChange={(checked) => toggleUtility(utility, checked)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <SwitchField
            label="Премиум"
            checked={draft.premium}
            onChange={(checked) => update({ premium: checked })}
          />
          <SwitchField
            label="Рассрочка"
            checked={draft.installment}
            onChange={(checked) => update({ installment: checked })}
          />
          <SwitchField
            label="Новостройка"
            checked={draft.isNewBuilding}
            onChange={(checked) => update({ isNewBuilding: checked })}
          />
        </div>
      </FormSection>

      <FormSection title="Медиа">
        <PhotoEditor
          values={draft.photos}
          onChange={(photos) => update({ photos })}
          onUpload={(file) => uploadFile(api, file, 'properties')}
        />
        <TextField
          label="Тон плейсхолдера"
          value={draft.placeholderTone}
          error={errors.placeholderTone}
          description="Опционально: оттенок брендового плейсхолдера, если фото нет."
          onChange={(value) => update({ placeholderTone: value })}
        />
      </FormSection>

      <FormSection title="Описание и бейджи">
        <StringListEditor
          label="Бейджи"
          description="Короткие метки на карточке (напр. «Вид на море»)."
          values={draft.badges}
          onChange={(badges) => update({ badges })}
          placeholder="Добавить бейдж"
        />
        <StringListEditor
          label="Что входит (features)"
          values={draft.features}
          onChange={(features) => update({ features })}
          placeholder="Добавить пункт"
        />
      </FormSection>

      <FormSection
        title="Координаты на карте"
        description="Точка показывается на карточке объекта (Яндекс.Карты)."
      >
        <CoordinatePicker
          lat={draft.lat}
          lng={draft.lng}
          onChange={(next) => update(next)}
        />
      </FormSection>

      <FormSection
        title="Личный менеджер"
        description="Если задан — используется первым в цепочке контакта карточки."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Имя"
            value={draft.managerName}
            error={errors.managerName}
            onChange={(value) => update({ managerName: value })}
          />
          <TextField
            label="Телефон"
            value={draft.managerPhone}
            error={errors.managerPhone}
            onChange={(value) => update({ managerPhone: value })}
          />
          <TextField
            label="Фото (URL)"
            value={draft.managerPhotoUrl}
            error={errors.managerPhotoUrl}
            onChange={(value) => update({ managerPhotoUrl: value })}
          />
        </div>
      </FormSection>

      {formError && (
        <Alert variant="destructive">
          <AlertTitle>Не сохранено</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-background/95 py-4 backdrop-blur">
        <Button type="submit" size="lg" disabled={isSaving}>
          {isSaving ? 'Сохранение…' : property ? 'Сохранить' : 'Создать объект'}
        </Button>
      </div>
    </form>
  )
}
