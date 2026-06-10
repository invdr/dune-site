import {
  createPropertySchema,
  type CommercialKind,
  type CreatePropertyRequest,
  type Currency,
  type LandUse,
  type PropertyDirection,
  type PropertyDto,
  type PropertyStatus,
  type PropertyType,
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
  currencies,
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
  currency: Currency
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
    currency: property?.currency ?? 'RUB',
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

function toPayload(draft: Draft): CreatePropertyRequest {
  return {
    slug: draft.slug.trim(),
    title: draft.title,
    direction: draft.direction,
    type: draft.type,
    status: draft.status,
    currency: draft.currency,
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
    source: 'SITE',
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

export function PropertyForm({
  property,
  isSaving,
  onSubmit,
}: {
  property?: PropertyDto
  isSaving: boolean
  onSubmit: (payload: CreatePropertyRequest) => Promise<void>
}) {
  const { api } = useAuth()
  const [draft, setDraft] = useState<Draft>(() => toDraft(property))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const isMirrored = property?.source === 'QUICKDEAL'
  const isResidential = residentialTypes.includes(draft.type)
  const isLand = draft.type === 'LAND'
  const isCommercial = draft.type === 'COMMERCIAL'

  function update(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function changeDirection(direction: PropertyDirection) {
    // Keep money aligned with the market: RF → ₽, abroad → $ (§5).
    update({ direction, currency: defaultCurrencyForDirection(direction) })
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
    const payload = toPayload(draft)
    const result = createPropertySchema.safeParse(payload)
    if (!result.success) {
      const nextErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? '')
        if (key && !nextErrors[key]) nextErrors[key] = issue.message
      }
      setErrors(nextErrors)
      setFormError('Проверьте выделенные поля.')
      return
    }
    setErrors({})
    try {
      await onSubmit(result.data)
    } catch (caughtError) {
      setFormError(caughtError instanceof Error ? caughtError.message : 'Не удалось сохранить объект')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      {isMirrored && (
        <Alert>
          <AlertTitle>Объект из QuickDeal</AlertTitle>
          <AlertDescription>
            Основные поля приходят из фида и перезапишутся при синхронизации. Здесь стоит менять
            только «сайтовый слой»: подборки, бейджи, премиум, статус публикации.
          </AlertDescription>
        </Alert>
      )}

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
            onChange={changeDirection}
            options={directions.map((value) => ({ value, label: directionLabels[value] }))}
          />
          <SelectField
            label="Тип"
            required
            value={draft.type}
            error={errors.type}
            onChange={(value) => update({ type: value })}
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
            label="Цена"
            required
            inputMode="numeric"
            value={draft.price}
            error={errors.price}
            description="0 — отображается как «Цена по запросу»."
            onChange={(value) => update({ price: value })}
          />
          <SelectField
            label="Валюта"
            value={draft.currency}
            error={errors.currency}
            onChange={(value) => update({ currency: value })}
            options={currencies.map((value) => ({ value, label: currencyLabels[value] }))}
          />
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
