import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { FormSection, TextField, TextareaField } from '@/components/admin/form-controls'
import { LoadingRow, PageContainer, PageHeader } from '@/components/admin/page'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Typography } from '@/components/ui/typography'
import { useHomeContent, useProperties, useUpdateHomeContent } from '@/lib/admin-queries'
import { directionLabels } from '@/lib/labels'
import { uploadFile } from '@/lib/upload'
import { useAuth } from '@/lib/use-auth'

export function HomeContentPage() {
  const { api } = useAuth()
  const contentQuery = useHomeContent()
  const updateContent = useUpdateHomeContent()
  // Pull published listings so the editor can offer them as curated picks.
  const propertiesQuery = useProperties({ status: 'PUBLISHED', limit: 100 })

  const [heroTitle, setHeroTitle] = useState('')
  const [heroSubtitle, setHeroSubtitle] = useState('')
  const [heroImageUrl, setHeroImageUrl] = useState('')
  const [chosenSlugs, setChosenSlugs] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const loadedRef = useRef(false)

  // Seed local state once the singleton arrives; afterwards it is user-owned.
  useEffect(() => {
    if (loadedRef.current || !contentQuery.data) return
    const content = contentQuery.data.content
    setHeroTitle(content.heroTitle ?? '')
    setHeroSubtitle(content.heroSubtitle ?? '')
    setHeroImageUrl(content.heroImageUrl ?? '')
    setChosenSlugs(content.chosenSlugs)
    loadedRef.current = true
  }, [contentQuery.data])

  const properties = propertiesQuery.data?.items ?? []
  const filtered = properties.filter((property) =>
    property.title.toLowerCase().includes(search.trim().toLowerCase()),
  )
  // Curated slugs that no longer match a published listing — kept so saving
  // doesn't silently drop them.
  const orphanSlugs = chosenSlugs.filter(
    (slug) => !properties.some((property) => property.slug === slug),
  )

  function toggleSlug(slug: string, checked: boolean) {
    setChosenSlugs((current) =>
      checked ? [...current, slug] : current.filter((item) => item !== slug),
    )
  }

  async function handleUpload(file: File | undefined) {
    if (!file) return
    setIsUploading(true)
    try {
      setHeroImageUrl(await uploadFile(api, file, 'home'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка загрузки')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSave() {
    try {
      await updateContent.mutateAsync({
        heroTitle,
        heroSubtitle,
        heroImageUrl,
        chosenSlugs,
      })
      toast.success('Контент главной сохранён')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось сохранить')
    }
  }

  if (contentQuery.isLoading) {
    return (
      <PageContainer>
        <LoadingRow />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title="Главная страница"
        description="Тексты hero-блока и подборка объектов для витрины (§6)."
      />

      <div className="grid gap-5">
        <FormSection title="Hero-блок">
          <TextField label="Заголовок" value={heroTitle} onChange={setHeroTitle} />
          <TextareaField label="Подзаголовок" value={heroSubtitle} onChange={setHeroSubtitle} rows={3} />
          <div className="grid gap-2">
            <FieldLabel>Фоновое изображение</FieldLabel>
            <FieldDescription>Ссылка на изображение или загрузка файла.</FieldDescription>
            <div className="flex flex-wrap gap-2">
              <Input
                value={heroImageUrl}
                placeholder="https://…/hero.jpg"
                className="min-w-[220px] flex-1"
                onChange={(event) => setHeroImageUrl(event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? <Spinner className="size-4" /> : 'Загрузить'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => void handleUpload(event.target.files?.[0])}
              />
            </div>
            {heroImageUrl && (
              <img
                src={heroImageUrl}
                alt=""
                className="aspect-[16/6] w-full rounded-2xl border border-border object-cover"
              />
            )}
          </div>
        </FormSection>

        <FormSection
          title="Подборка объектов"
          description="Отметьте опубликованные объекты для ленты на главной."
        >
          <Input
            placeholder="Поиск по названию…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {orphanSlugs.length > 0 && (
            <Alert>
              <AlertTitle>Сохранены неопубликованные подборки</AlertTitle>
              <AlertDescription>
                {orphanSlugs.length} объект(ов) не входят в опубликованный каталог, но остаются в
                подборке: {orphanSlugs.join(', ')}
              </AlertDescription>
            </Alert>
          )}
          {propertiesQuery.isLoading ? (
            <LoadingRow label="Загрузка объектов…" />
          ) : (
            <ul className="grid max-h-96 gap-1 overflow-y-auto rounded-2xl border border-border p-2">
              {filtered.map((property) => {
                const checked = chosenSlugs.includes(property.slug)
                return (
                  <li key={property.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-input/30">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(next) => toggleSlug(property.slug, next === true)}
                      />
                      <span className="grid gap-0.5">
                        <Typography as="span" variant="bodySmMedium">
                          {property.title}
                        </Typography>
                        <Typography as="span" variant="bodyXs" tone="muted">
                          {property.city} · /{property.slug}
                        </Typography>
                      </span>
                      <Badge variant="outline" className="ml-auto">
                        {directionLabels[property.direction]}
                      </Badge>
                    </label>
                  </li>
                )
              })}
              {filtered.length === 0 && (
                <li className="px-3 py-6">
                  <Typography variant="bodySm" tone="muted" align="center">
                    Ничего не найдено.
                  </Typography>
                </li>
              )}
            </ul>
          )}
          <Typography variant="bodySm" tone="muted">
            {chosenSlugs.length} объектов выбрано
          </Typography>
        </FormSection>

        <div className="sticky bottom-0 flex justify-end border-t bg-background/95 py-4 backdrop-blur">
          <Button size="lg" disabled={updateContent.isPending} onClick={() => void handleSave()}>
            {updateContent.isPending ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </PageContainer>
  )
}
