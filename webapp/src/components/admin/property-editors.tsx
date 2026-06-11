import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon, Cancel01Icon, Image02Icon } from '@hugeicons/core-free-icons'
import { useEffect, useRef, useState } from 'react'

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

// --- Yandex Maps JS API loader (single shared script) ---------------------
// Minimal surface of the ymaps 2.1 API we use for the coordinate picker.
type YmapsEvent = { get(name: string): unknown }
type YmapsGeometry = {
  getCoordinates(): [number, number]
  setCoordinates(coords: [number, number]): void
}
type YmapsPlacemark = {
  geometry: YmapsGeometry
  events: { add(event: string, handler: () => void): void }
}
type YmapsMap = {
  geoObjects: { add(object: unknown): void }
  events: { add(event: string, handler: (e: YmapsEvent) => void): void }
  setCenter(coords: [number, number], zoom?: number): void
  destroy(): void
}
type YmapsApi = {
  ready(callback: () => void): void
  Map: new (
    element: HTMLElement,
    options: { center: [number, number]; zoom: number; controls?: string[] },
  ) => YmapsMap
  Placemark: new (
    coords: [number, number],
    properties?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => YmapsPlacemark
}

declare global {
  interface Window {
    ymaps?: YmapsApi
  }
}

// Grozny — sensible default centre when the object has no point yet.
const DEFAULT_CENTER: [number, number] = [43.3169, 45.6981]
const round6 = (n: number) => Math.round(n * 1e6) / 1e6

let ymapsPromise: Promise<YmapsApi> | null = null
function loadYmaps(apiKey: string): Promise<YmapsApi> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.ymaps) return Promise.resolve(window.ymaps)
  if (ymapsPromise) return ymapsPromise
  ymapsPromise = new Promise<YmapsApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`
    script.async = true
    script.onload = () => {
      const api = window.ymaps
      if (api) api.ready(() => resolve(api))
      else reject(new Error('ymaps unavailable after load'))
    }
    script.onerror = () => {
      ymapsPromise = null
      reject(new Error('failed to load ymaps'))
    }
    document.head.appendChild(script)
  })
  return ymapsPromise
}

// Interactive click-to-place map, shown when a Yandex JS API key is configured.
// Clicking the map (or dragging the marker) writes lat/lng back to the form.
// Falls back to a notice if the API key is rejected or the script fails.
function InteractiveMap({
  apiKey,
  lat,
  lng,
  onPick,
}: {
  apiKey: string
  lat: number | null
  lng: number | null
  onPick: (lat: number, lng: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<YmapsMap | null>(null)
  const placemarkRef = useRef<YmapsPlacemark | null>(null)
  const placedRef = useRef(false)
  const onPickRef = useRef(onPick)
  const [failed, setFailed] = useState(false)

  // Keep the latest onPick without re-running the map-build effect.
  useEffect(() => {
    onPickRef.current = onPick
  }, [onPick])

  // Build the map once per key. Reading lat/lng here only seeds the initial
  // centre/marker; external edits are synced by the effect below.
  useEffect(() => {
    let cancelled = false
    const seedLat = lat
    const seedLng = lng
    loadYmaps(apiKey)
      .then((ymaps) => {
        if (cancelled || !containerRef.current) return
        const hasSeed = seedLat != null && seedLng != null
        const center: [number, number] = hasSeed ? [seedLat, seedLng] : DEFAULT_CENTER
        const map = new ymaps.Map(containerRef.current, { center, zoom: 15, controls: ['zoomControl'] })
        const placemark = new ymaps.Placemark(center, {}, { draggable: true })
        if (hasSeed) {
          map.geoObjects.add(placemark)
          placedRef.current = true
        }
        const commit = (coords: [number, number]) => onPickRef.current(round6(coords[0]), round6(coords[1]))
        map.events.add('click', (event) => {
          const coords = event.get('coords') as [number, number] | undefined
          if (!coords) return
          placemark.geometry.setCoordinates(coords)
          if (!placedRef.current) {
            map.geoObjects.add(placemark)
            placedRef.current = true
          }
          commit(coords)
        })
        placemark.events.add('dragend', () => commit(placemark.geometry.getCoordinates()))
        mapRef.current = map
        placemarkRef.current = placemark
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      mapRef.current?.destroy()
      mapRef.current = null
      placemarkRef.current = null
      placedRef.current = false
    }
    // Re-init only when the key changes; coord sync is handled separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  // Reflect numeric-input edits onto the marker without rebuilding the map.
  useEffect(() => {
    const map = mapRef.current
    const placemark = placemarkRef.current
    if (!map || !placemark || lat == null || lng == null) return
    placemark.geometry.setCoordinates([lat, lng])
    if (!placedRef.current) {
      map.geoObjects.add(placemark)
      placedRef.current = true
    }
    map.setCenter([lat, lng])
  }, [lat, lng])

  if (failed) {
    return (
      <Typography
        variant="bodySm"
        tone="muted"
        className="rounded-2xl border border-dashed border-border bg-input/20 px-4 py-6 text-center"
      >
        Не удалось загрузить карту — проверьте API-ключ Яндекс.Карт в настройках. Координаты можно ввести вручную выше.
      </Typography>
    )
  }

  return <div ref={containerRef} className="h-64 w-full overflow-hidden rounded-2xl border border-border" />
}

// Coordinate picker. With a Yandex JS API key (configured in site settings) it
// shows an interactive click-to-place map; without a key it falls back to a
// keyless map-widget preview. Numeric lat/lng inputs stay available either way.
export function CoordinatePicker({
  lat,
  lng,
  apiKey,
  onChange,
}: {
  lat: string
  lng: string
  apiKey?: string | null
  onChange: (next: { lat?: string; lng?: string }) => void
}) {
  const latNum = Number.parseFloat(lat)
  const lngNum = Number.parseFloat(lng)
  const hasPoint = Number.isFinite(latNum) && Number.isFinite(lngNum)
  const hasKey = Boolean(apiKey && apiKey.trim().length > 0)

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
      {hasKey ? (
        <InteractiveMap
          apiKey={(apiKey as string).trim()}
          lat={hasPoint ? latNum : null}
          lng={hasPoint ? lngNum : null}
          onPick={(nextLat, nextLng) => onChange({ lat: String(nextLat), lng: String(nextLng) })}
        />
      ) : hasPoint ? (
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
