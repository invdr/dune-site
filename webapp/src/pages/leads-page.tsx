import { useState } from 'react'
import { toast } from 'sonner'
import type { LeadListQuery, LeadStatus } from '@dune/contracts'

import { LoadingRow, PageContainer, PageHeader } from '@/components/admin/page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
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
import { useLeads, useUpdateLead } from '@/lib/admin-queries'
import { directionLabels, leadStatusBadge, leadStatusLabels, leadStatuses } from '@/lib/labels'

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function LeadsPage() {
  const [query, setQuery] = useState<Partial<LeadListQuery>>({ page: 1, limit: 25 })
  const leadsQuery = useLeads(query)
  const updateLead = useUpdateLead()
  const data = leadsQuery.data
  const items = data?.items ?? []

  function patchQuery(patch: Partial<LeadListQuery>) {
    setQuery((current) => ({ ...current, ...patch, page: patch.page ?? 1 }))
  }

  async function changeStatus(id: string, status: LeadStatus) {
    try {
      await updateLead.mutateAsync({ id, input: { status } })
      toast.success('Статус обновлён')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось обновить статус')
    }
  }

  return (
    <PageContainer>
      <PageHeader title="Заявки" description="Лиды с сайта: статусы и доставка в Telegram." />

      <div className="mb-4 flex flex-wrap gap-2">
        <NativeSelect
          value={query.status ?? ''}
          onChange={(event) =>
            patchQuery({ status: (event.target.value || undefined) as LeadStatus | undefined })
          }
        >
          <NativeSelectOption value="">Все статусы</NativeSelectOption>
          {leadStatuses.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {leadStatusLabels[value]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {leadsQuery.isError ? (
        <Empty>
          <EmptyTitle>Не удалось загрузить заявки</EmptyTitle>
          <EmptyDescription>{(leadsQuery.error as Error).message}</EmptyDescription>
        </Empty>
      ) : leadsQuery.isLoading ? (
        <LoadingRow />
      ) : items.length === 0 ? (
        <Empty>
          <EmptyTitle>Заявок пока нет</EmptyTitle>
          <EmptyDescription>Новые заявки с сайта появятся здесь.</EmptyDescription>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Контакт</TableHead>
                <TableHead>Сообщение</TableHead>
                <TableHead>Источник</TableHead>
                <TableHead>Получена</TableHead>
                <TableHead>Telegram</TableHead>
                <TableHead className="w-40">Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <div className="grid gap-0.5">
                      <Typography as="span" variant="bodySmMedium">
                        {lead.name}
                      </Typography>
                      <Typography asChild variant="bodyXs" tone="muted">
                        <a href={`tel:${lead.phone}`} className="hover:underline">
                          {lead.phone}
                        </a>
                      </Typography>
                      {lead.email && (
                        <Typography as="span" variant="bodyXs" tone="muted">
                          {lead.email}
                        </Typography>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <Typography as="span" variant="bodySm" tone="muted" className="line-clamp-3">
                      {lead.message ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <div className="grid gap-0.5">
                      <Typography as="span" variant="bodyXs" tone="muted">
                        {lead.source ?? '—'}
                      </Typography>
                      {lead.direction && (
                        <Typography as="span" variant="bodyXs" tone="muted">
                          {directionLabels[lead.direction]}
                        </Typography>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Typography as="span" variant="bodyXs" tone="muted">
                      {dateFormatter.format(new Date(lead.createdAt))}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {lead.telegramSentAt ? (
                      <Badge variant="outline">отправлено</Badge>
                    ) : (
                      <Badge variant="secondary">—</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={leadStatusBadge[lead.status]}>
                        {leadStatusLabels[lead.status]}
                      </Badge>
                      <NativeSelect
                        size="sm"
                        value={lead.status}
                        disabled={updateLead.isPending}
                        aria-label="Сменить статус"
                        onChange={(event) => void changeStatus(lead.id, event.target.value as LeadStatus)}
                      >
                        {leadStatuses.map((value) => (
                          <NativeSelectOption key={value} value={value}>
                            {leadStatusLabels[value]}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
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
    </PageContainer>
  )
}
