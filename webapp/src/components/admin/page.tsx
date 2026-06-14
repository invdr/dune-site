import type { ReactNode } from 'react'

import { Spinner } from '@/components/ui/spinner'
import { Typography } from '@/components/ui/typography'

export function LoadingRow({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-12">
      <Spinner />
      <Typography as="span" variant="bodySm" tone="muted">
        {label}
      </Typography>
    </div>
  )
}

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl px-5 py-8">{children}</div>
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  // Optional header actions (buttons) rendered on the trailing edge.
  children?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="grid gap-1">
        <Typography variant="h3">{title}</Typography>
        {description && (
          <Typography tone="muted" variant="bodySm">
            {description}
          </Typography>
        )}
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  )
}
