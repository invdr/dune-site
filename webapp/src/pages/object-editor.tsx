import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import type { CreatePropertyRequest } from '@dune/contracts'

import { LoadingRow, PageContainer, PageHeader } from '@/components/admin/page'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { useCreateProperty, useProperty, useUpdateProperty } from '@/lib/admin-queries'
import { PropertyForm } from './property-form'

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="gap-2">
      <Link to="/objects">
        <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-4" />К объектам
      </Link>
    </Button>
  )
}

export function NewObjectPage() {
  const navigate = useNavigate()
  const createProperty = useCreateProperty()

  async function handleSubmit(payload: CreatePropertyRequest) {
    const { property } = await createProperty.mutateAsync(payload)
    toast.success('Объект создан')
    void navigate({ to: '/objects/$propertyId', params: { propertyId: property.id } })
  }

  return (
    <PageContainer>
      <div className="mb-2">
        <BackLink />
      </div>
      <PageHeader title="Новый объект" description="Заполните карточку и сохраните." />
      <PropertyForm isSaving={createProperty.isPending} onSubmit={handleSubmit} />
    </PageContainer>
  )
}

export function EditObjectPage() {
  const { propertyId } = useParams({ from: '/objects/$propertyId' })
  const propertyQuery = useProperty(propertyId)
  const updateProperty = useUpdateProperty(propertyId)

  async function handleSubmit(payload: CreatePropertyRequest) {
    await updateProperty.mutateAsync(payload)
    toast.success('Изменения сохранены')
  }

  return (
    <PageContainer>
      <div className="mb-2">
        <BackLink />
      </div>
      {propertyQuery.isLoading ? (
        <LoadingRow />
      ) : propertyQuery.isError || !propertyQuery.data ? (
        <Empty>
          <EmptyTitle>Объект не найден</EmptyTitle>
          <EmptyDescription>Возможно, он был удалён.</EmptyDescription>
        </Empty>
      ) : (
        <>
          <PageHeader
            title={propertyQuery.data.property.title}
            description={`/${propertyQuery.data.property.slug}`}
          />
          <PropertyForm
            property={propertyQuery.data.property}
            isSaving={updateProperty.isPending}
            onSubmit={handleSubmit}
          />
        </>
      )}
    </PageContainer>
  )
}
