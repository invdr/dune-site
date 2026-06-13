import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, Delete02Icon, DownloadSquare01Icon, PencilEdit02Icon } from '@hugeicons/core-free-icons'
import { useState } from 'react'
import { toast } from 'sonner'
import type { AdminComplexListQuery, PropertyStatus } from '@dune/contracts'

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Typography } from '@/components/ui/typography'
import { useBulkCreateComplexes, useComplexes, useDeleteComplex } from '@/lib/admin-queries'
import { propertyStatuses, statusBadge, statusLabels } from '@/lib/labels'

const priceFormatter = new Intl.NumberFormat('ru-RU')

export function ComplexesListPage() {
  const [query, setQuery] = useState<Partial<AdminComplexListQuery>>({ page: 1, limit: 20 })
  const complexesQuery = useComplexes(query)
  const deleteComplex = useDeleteComplex()
  const bulkCreate = useBulkCreateComplexes()
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)

  const data = complexesQuery.data
  const items = data?.items ?? []

  function patchQuery(patch: Partial<AdminComplexListQuery>) {
    setQuery((current) => ({ ...current, ...patch, page: patch.page ?? 1 }))
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    await deleteComplex.mutateAsync(pendingDelete.id)
    setPendingDelete(null)
  }

  async function runBulk() {
    try {
      const result = await bulkCreate.mutateAsync()
      toast.success(
        result.created > 0
          ? `Создано ЖК: ${result.created}${result.skipped ? `, пропущено: ${result.skipped}` : ''}`
          : 'Новых ЖК не найдено — все уже заведены.',
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось импортировать ЖК.')
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="ЖК"
        description="Жилые комплексы (новостройки): карточки, фото, характеристики и публикация."
      >
        <Button
          variant="outline"
          className="gap-2"
          disabled={bulkCreate.isPending}
          onClick={() => void runBulk()}
        >
          <HugeiconsIcon icon={DownloadSquare01Icon} strokeWidth={2} className="size-4" />
          {bulkCreate.isPending ? 'Импорт…' : 'Импорт из объектов'}
        </Button>
        <Button asChild className="gap-2">
          <Link to="/complexes/new">
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
            Создать ЖК
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

      {complexesQuery.isError ? (
        <Empty>
          <EmptyTitle>Не удалось загрузить ЖК</EmptyTitle>
          <EmptyDescription>{(complexesQuery.error as Error).message}</EmptyDescription>
        </Empty>
      ) : complexesQuery.isLoading ? (
        <LoadingRow />
      ) : items.length === 0 ? (
        <Empty>
          <EmptyTitle>Жилых комплексов пока нет</EmptyTitle>
          <EmptyDescription>
            Создайте ЖК вручную или нажмите «Импорт из объектов», чтобы собрать черновики из новостроек.
          </EmptyDescription>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ЖК</TableHead>
                <TableHead>Город</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Квартир</TableHead>
                <TableHead className="text-right">Цена от</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((complex) => (
                <TableRow key={complex.id}>
                  <TableCell>
                    <Link to="/complexes/$complexId" params={{ complexId: complex.id }} className="grid gap-0.5">
                      <Typography as="span" variant="bodySmMedium">
                        {complex.name}
                      </Typography>
                      <Typography as="span" variant="bodyXs" tone="muted">
                        /{complex.slug}
                        {complex.developer ? ` · ${complex.developer}` : ''}
                      </Typography>
                    </Link>
                  </TableCell>
                  <TableCell>{complex.city}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadge[complex.status]}>{statusLabels[complex.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{complex.unitCount}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {complex.pricePerMeterFrom != null
                      ? `${priceFormatter.format(complex.pricePerMeterFrom)} ₽/м²`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button asChild size="icon" variant="ghost" className="size-8" aria-label="Редактировать">
                        <Link to="/complexes/$complexId" params={{ complexId: complex.id }}>
                          <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-destructive"
                        aria-label="Удалить"
                        onClick={() => setPendingDelete({ id: complex.id, name: complex.name })}
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
            <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => patchQuery({ page: data.page - 1 })}>
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
            <AlertDialogTitle>Удалить ЖК?</AlertDialogTitle>
            <AlertDialogDescription>
              «{pendingDelete?.name}» будет удалён без возможности восстановления. Квартиры, привязанные по названию, не удаляются.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void confirmDelete()
              }}
              disabled={deleteComplex.isPending}
            >
              {deleteComplex.isPending ? 'Удаление…' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  )
}
