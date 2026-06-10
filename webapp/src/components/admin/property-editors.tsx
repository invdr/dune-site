import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon, Cancel01Icon, Image02Icon } from '@hugeicons/core-free-icons'
import { useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Typography } from '@/components/ui/typography'

// Chip-style editor for the badges / features string arrays.
export function StringListEditor({
  label,
  description,
  values,
  onChange,
  placeholder,
}: {
  label: string
  description?: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')

  function add() {
    const value = draft.trim()
    if (!value || values.includes(value)) {
      setDraft('')
      return
    }
    onChange([...values, value])
    setDraft('')
  }

  return (
    <div className="grid gap-2">
      <FieldLabel>{label}</FieldLabel>
      {description && <FieldDescription>{description}</FieldDescription>}
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add()
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add}>
          Добавить
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <Badge key={value} variant="outline" className="gap-1.5">
              {value}
              <button
                type="button"
                aria-label={`Удалить ${value}`}
                className="grid place-content-center rounded-full hover:text-destructive"
                onClick={() => onChange(values.filter((item) => item !== value))}
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

// Photo gallery editor: paste a hot-link URL (QuickDeal photos are hot-linked)
// or upload a file to object storage. Supports remove and reorder.
export function PhotoEditor({
  values,
  onChange,
  onUpload,
}: {
  values: string[]
  onChange: (values: string[]) => void
  onUpload?: (file: File) => Promise<string>
}) {
  const [urlDraft, setUrlDraft] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function addUrl() {
    const value = urlDraft.trim()
    if (!value || values.includes(value)) {
      setUrlDraft('')
      return
    }
    onChange([...values, value])
    setUrlDraft('')
  }

  function move(index: number, delta: number) {
    const next = [...values]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !onUpload) return
    setError(null)
    setIsUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of Array.from(files)) {
        uploaded.push(await onUpload(file))
      }
      onChange([...values, ...uploaded])
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Ошибка загрузки')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="grid gap-3">
      <FieldLabel>Фотографии</FieldLabel>
      <FieldDescription>
        Вставьте ссылку на изображение или загрузите файл. Первое фото — обложка.
      </FieldDescription>

      <div className="flex flex-wrap gap-2">
        <Input
          value={urlDraft}
          placeholder="https://…/photo.jpg"
          className="min-w-[220px] flex-1"
          onChange={(event) => setUrlDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addUrl()
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addUrl}>
          Добавить ссылку
        </Button>
        {onUpload && (
          <Button
            type="button"
            variant="outline"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            {isUploading ? <Spinner className="size-4" /> : <HugeiconsIcon icon={Image02Icon} strokeWidth={2} className="size-4" />}
            Загрузить файл
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => void handleFiles(event.target.files)}
        />
      </div>

      {error && (
        <Typography variant="bodySm" tone="destructive">
          {error}
        </Typography>
      )}

      {values.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {values.map((url, index) => (
            <li key={url} className="group relative overflow-hidden rounded-2xl border border-border bg-input/20">
              <img
                src={url}
                alt=""
                loading="lazy"
                className="aspect-[4/3] w-full object-cover"
                onError={(event) => {
                  event.currentTarget.style.opacity = '0.2'
                }}
              />
              {index === 0 && (
                <Badge className="absolute left-2 top-2">Обложка</Badge>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-background/85 p-1.5">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label="Левее"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label="Правее"
                    disabled={index === values.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4" />
                  </Button>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 text-destructive"
                  aria-label="Удалить фото"
                  onClick={() => onChange(values.filter((item) => item !== url))}
                >
                  <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Coordinate picker. The interactive click-to-place map needs a Yandex JS API key
// (blocked on the client per §4.2), so v1 takes numeric lat/lng and shows a
// keyless map-widget preview — the same widget the public card uses.
export function CoordinatePicker({
  lat,
  lng,
  onChange,
}: {
  lat: string
  lng: string
  onChange: (next: { lat?: string; lng?: string }) => void
}) {
  const latNum = Number.parseFloat(lat)
  const lngNum = Number.parseFloat(lng)
  const hasPoint = Number.isFinite(latNum) && Number.isFinite(lngNum)

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <FieldLabel htmlFor="coord-lat">Широта (lat)</FieldLabel>
          <Input
            id="coord-lat"
            inputMode="decimal"
            value={lat}
            placeholder="43.3169"
            onChange={(event) => onChange({ lat: event.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <FieldLabel htmlFor="coord-lng">Долгота (lng)</FieldLabel>
          <Input
            id="coord-lng"
            inputMode="decimal"
            value={lng}
            placeholder="45.6981"
            onChange={(event) => onChange({ lng: event.target.value })}
          />
        </div>
      </div>
      {hasPoint ? (
        <iframe
          title="Карта объекта"
          className="h-64 w-full rounded-2xl border border-border"
          loading="lazy"
          src={`https://yandex.ru/map-widget/v1/?ll=${lngNum},${latNum}&z=16&pt=${lngNum},${latNum},pm2rdm`}
        />
      ) : (
        <Typography
          variant="bodySm"
          tone="muted"
          className="rounded-2xl border border-dashed border-border bg-input/20 px-4 py-6 text-center"
        >
          Укажите координаты, чтобы увидеть точку на карте.
        </Typography>
      )}
    </div>
  )
}
