import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, Delete02Icon, PencilEdit02Icon } from '@hugeicons/core-free-icons'
import { useState } from 'react'
import type { AdminPropertyListQuery, PropertyStatus, PropertyType, PropertyDirection } from '@dune/contracts'

import { LoadingRow, PageContainer, PageHeader } from '@/components/admin/page'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Typography } from '@/components/ui/typography'
import { useDeleteProperty, useProperties } from '@/lib/admin-queries'
import {
  directionLabels,
  directions,
  propertyStatuses,
  propertyTypes,
  statusBadge,
  statusLabels,
  typeLabels,
} from '@/lib/labels'

const priceFormatter = new Intl.NumberFormat('ru-RU')

export function ObjectsListPage() {
  const [query, setQuery] = useState<Partial<AdminPropertyListQuery>>({ page: 1, limit: 20 })
  const propertiesQuery = useProperties(query)
  const deleteProperty = useDeleteProperty()
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null)

  const data = propertiesQuery.data
  const items = data?.items ?? []

  function patchQuery(patch: Partial<AdminPropertyListQuery>) {
    // Any filter change resets to page 1 so results stay consistent.
    setQuery((current) => ({ ...current, ...patch, page: patch.page ?? 1 }))
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    await deleteProperty.mutateAsync(pendingDelete.id)
    setPendingDelete(null)
  }

  return (
    <PageContainer>
      <PageHeader
        title="Объекты"
        description="Каталог недвижимости: создание, редактирование и публикация."
      >
        <Button asChild className="gap-2">
          <Link to="/objects/new">
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
            Создать объект
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Поиск по названию…"
          className="w-full sm:w-56"
          value={query.q ?? ''}
          onChange={(event) => patchQuery({ q: event.target.value || undefined })}
        />
        <NativeSelect
          value={query.direction ?? ''}
          onChange={(event) =>
            patchQuery({ direction: (event.target.value || undefined) as PropertyDirection | undefined })
          }
        >
          <NativeSelectOption value="">Все направления</NativeSelectOption>
          {directions.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {directionLabels[value]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          value={query.type ?? ''}
          onChange={(event) =>
            patchQuery({ type: (event.target.value || undefined) as PropertyType | undefined })
          }
        >
          <NativeSelectOption value="">Все типы</NativeSelectOption>
          {propertyTypes.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {typeLabels[value]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          value={query.status ?? ''}
          onChange={(event) =>
            patchQuery({ status: (event.target.value || undefined) as PropertyStatus | undefined })
          }
        >
          <NativeSelectOption value="">Все статусы</NativeSelectOption>
          {propertyStatuses.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {statusLabels[value]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {propertiesQuery.isError ? (
        <Empty>
          <EmptyTitle>Не удалось загрузить объекты</EmptyTitle>
          <EmptyDescription>
            {(propertiesQuery.error as Error).message}
          </EmptyDescription>
        </Empty>
      ) : propertiesQuery.isLoading ? (
        <LoadingRow />
      ) : items.length === 0 ? (
        <Empty>
          <EmptyTitle>Объектов пока нет</EmptyTitle>
          <EmptyDescription>Создайте первый объект или измените фильтры.</EmptyDescription>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Объект</TableHead>
                <TableHead>Направление</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Цена</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((property) => (
                <TableRow key={property.id}>
                  <TableCell>
                    <Link to="/objects/$propertyId" params={{ propertyId: property.id }} className="grid gap-0.5">
                      <Typography as="span" variant="bodySmMedium">
                        {property.title}
                      </Typography>
                      <Typography as="span" variant="bodyXs" tone="muted">
                        {property.city} · /{property.slug}
                      </Typography>
                    </Link>
                  </TableCell>
                  <TableCell>{directionLabels[property.direction]}</TableCell>
                  <TableCell>{typeLabels[property.type]}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadge[property.status]}>
                      {statusLabels[property.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {property.price > 0
                      ? `${priceFormatter.format(property.price)} ${property.currency === 'USD' ? '$' : '₽'}`
                      : 'по запросу'}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button asChild size="icon" variant="ghost" className="size-8" aria-label="Редактировать">
                        <Link to="/objects/$propertyId" params={{ propertyId: property.id }}>
                          <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-destructive"
                        aria-label="Удалить"
                        onClick={() => setPendingDelete({ id: property.id, title: property.title })}
                      >
                        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data && data.pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <Typography variant="bodySm" tone="muted">
            Всего: {data.total} · страница {data.page} из {data.pageCount}
          </Typography>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => patchQuery({ page: data.page - 1 })}
            >
              Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= data.pageCount}
              onClick={() => patchQuery({ page: data.page + 1 })}
            >
              Вперёд
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить объект?</AlertDialogTitle>
            <AlertDialogDescription>
              «{pendingDelete?.title}» будет удалён без возможности восстановления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void confirmDelete()
              }}
              disabled={deleteProperty.isPending}
            >
              {deleteProperty.isPending ? 'Удаление…' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  )
}
