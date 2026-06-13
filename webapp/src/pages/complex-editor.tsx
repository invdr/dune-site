import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import type { CreateComplexRequest, UpdateComplexRequest } from '@dune/contracts'

import { LoadingRow, PageContainer, PageHeader } from '@/components/admin/page'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { useComplex, useCreateComplex, useUpdateComplex } from '@/lib/admin-queries'
import { ComplexForm } from './complex-form'

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="gap-2">
      <Link to="/complexes">
        <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-4" />К ЖК
      </Link>
    </Button>
  )
}

export function NewComplexPage() {
  const navigate = useNavigate()
  const createComplex = useCreateComplex()

  async function handleSubmit(payload: CreateComplexRequest | UpdateComplexRequest) {
    const { complex } = await createComplex.mutateAsync(payload as CreateComplexRequest)
    toast.success('ЖК создан')
    void navigate({ to: '/complexes/$complexId', params: { complexId: complex.id } })
  }

  return (
    <PageContainer>
      <div className="mb-2">
        <BackLink />
      </div>
      <PageHeader title="Новый ЖК" description="Заполните карточку жилого комплекса и сохраните." />
      <ComplexForm isSaving={createComplex.isPending} onSubmit={handleSubmit} />
    </PageContainer>
  )
}

export function EditComplexPage() {
  const { complexId } = useParams({ from: '/complexes/$complexId' })
  const complexQuery = useComplex(complexId)
  const updateComplex = useUpdateComplex(complexId)

  async function handleSubmit(payload: CreateComplexRequest | UpdateComplexRequest) {
    await updateComplex.mutateAsync(payload as UpdateComplexRequest)
    toast.success('Изменения сохранены')
  }

  return (
    <PageContainer>
      <div className="mb-2">
        <BackLink />
      </div>
      {complexQuery.isLoading ? (
        <LoadingRow />
      ) : complexQuery.isError || !complexQuery.data ? (
        <Empty>
          <EmptyTitle>ЖК не найден</EmptyTitle>
          <EmptyDescription>Возможно, он был удалён.</EmptyDescription>
        </Empty>
      ) : (
        <>
          <PageHeader
            title={complexQuery.data.complex.name}
            description={`/${complexQuery.data.complex.slug}`}
          />
          <ComplexForm
            complex={complexQuery.data.complex}
            isSaving={updateComplex.isPending}
            onSubmit={handleSubmit}
          />
        </>
      )}
    </PageContainer>
  )
}
