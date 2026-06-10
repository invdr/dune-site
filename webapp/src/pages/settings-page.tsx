import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ManagerDto, PropertyDirection } from '@dune/contracts'

import { FormSection, SwitchField, TextField } from '@/components/admin/form-controls'
import { LoadingRow, PageContainer, PageHeader } from '@/components/admin/page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import {
  useCreateManager,
  useDeleteManager,
  useManagers,
  useSettings,
  useUpdateManager,
  useUpdateSettings,
} from '@/lib/admin-queries'
import { directionLabels, directions } from '@/lib/labels'

export function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader title="Настройки" description="Интеграции, курс валют и менеджеры по направлениям." />
      <div className="grid gap-5">
        <SiteSettingsForm />
        <ManagersSection />
      </div>
    </PageContainer>
  )
}

function SiteSettingsForm() {
  const settingsQuery = useSettings()
  const updateSettings = useUpdateSettings()
  const loadedRef = useRef(false)

  const [telegramBotToken, setTelegramBotToken] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  const [bitrixWebhookUrl, setBitrixWebhookUrl] = useState('')
  const [bitrixEnabled, setBitrixEnabled] = useState(false)
  const [usdRubSurcharge, setUsdRubSurcharge] = useState('2')
  const [companyName, setCompanyName] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [companyContact, setCompanyContact] = useState('')

  useEffect(() => {
    if (loadedRef.current || !settingsQuery.data) return
    const settings = settingsQuery.data.settings
    setTelegramBotToken(settings.telegramBotToken ?? '')
    setTelegramChatId(settings.telegramChatId ?? '')
    setBitrixWebhookUrl(settings.bitrixWebhookUrl ?? '')
    setBitrixEnabled(settings.bitrixEnabled)
    setUsdRubSurcharge(String(settings.usdRubSurcharge))
    setCompanyName(settings.companyName ?? '')
    setCompanyPhone(settings.companyPhone ?? '')
    setCompanyContact(settings.companyContact ?? '')
    loadedRef.current = true
  }, [settingsQuery.data])

  async function handleSave() {
    const surcharge = Number.parseInt(usdRubSurcharge, 10)
    try {
      await updateSettings.mutateAsync({
        telegramBotToken,
        telegramChatId,
        bitrixWebhookUrl,
        bitrixEnabled,
        usdRubSurcharge: Number.isFinite(surcharge) ? surcharge : 0,
        companyName,
        companyPhone,
        companyContact,
      })
      toast.success('Настройки сохранены')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось сохранить настройки')
    }
  }

  if (settingsQuery.isLoading) {
    return <LoadingRow label="Загрузка настроек…" />
  }

  return (
    <>
      <FormSection
        title="Telegram"
        description="Уведомления о новых заявках. Включаются при заполненных токене и chat id."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Bot token" value={telegramBotToken} onChange={setTelegramBotToken} />
          <TextField label="Chat ID" value={telegramChatId} onChange={setTelegramChatId} />
        </div>
      </FormSection>

      <FormSection title="Bitrix24" description="Передача лидов во входящий вебхук CRM.">
        <TextField label="Webhook URL" value={bitrixWebhookUrl} onChange={setBitrixWebhookUrl} />
        <SwitchField
          label="Включить отправку в Bitrix24"
          description="По умолчанию выключено — ждёт доступы заказчика."
          checked={bitrixEnabled}
          onChange={setBitrixEnabled}
        />
      </FormSection>

      <FormSection title="Курс валют" description="Надбавка к курсу ЦБ при конвертации USD → ₽.">
        <TextField
          label="Надбавка USD→₽, ₽"
          inputMode="numeric"
          value={usdRubSurcharge}
          onChange={setUsdRubSurcharge}
          description="По умолчанию +2 ₽."
        />
      </FormSection>

      <FormSection
        title="Контакт компании"
        description="Общий контакт-фолбэк, если у направления нет менеджера."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Название" value={companyName} onChange={setCompanyName} />
          <TextField label="Телефон" value={companyPhone} onChange={setCompanyPhone} />
          <TextField label="Мессенджер / контакт" value={companyContact} onChange={setCompanyContact} />
        </div>
        <div className="flex justify-end">
          <Button size="lg" disabled={updateSettings.isPending} onClick={() => void handleSave()}>
            {updateSettings.isPending ? 'Сохранение…' : 'Сохранить настройки'}
          </Button>
        </div>
      </FormSection>
    </>
  )
}

function ManagersSection() {
  const managersQuery = useManagers()

  if (managersQuery.isLoading) {
    return <LoadingRow label="Загрузка менеджеров…" />
  }

  const byDirection = new Map<PropertyDirection, ManagerDto>()
  for (const manager of managersQuery.data?.items ?? []) {
    byDirection.set(manager.direction, manager)
  }

  return (
    <FormSection
      title="Менеджеры по направлениям"
      description="По одному активному менеджеру на направление (§10)."
    >
      <div className="grid gap-4">
        {directions.map((direction) => (
          <ManagerCard key={direction} direction={direction} manager={byDirection.get(direction)} />
        ))}
      </div>
    </FormSection>
  )
}

function ManagerCard({
  direction,
  manager,
}: {
  direction: PropertyDirection
  manager?: ManagerDto
}) {
  const createManager = useCreateManager()
  const updateManager = useUpdateManager()
  const deleteManager = useDeleteManager()

  const [name, setName] = useState(manager?.name ?? '')
  const [phone, setPhone] = useState(manager?.phone ?? '')
  const [contact, setContact] = useState(manager?.contact ?? '')
  const [photo, setPhoto] = useState(manager?.photo ?? '')
  const [active, setActive] = useState(manager?.active ?? true)

  // Re-seed when the underlying manager identity changes (after create/delete).
  const seedKey = manager?.id ?? 'none'
  const seededRef = useRef(seedKey)
  if (seededRef.current !== seedKey) {
    seededRef.current = seedKey
    setName(manager?.name ?? '')
    setPhone(manager?.phone ?? '')
    setContact(manager?.contact ?? '')
    setPhoto(manager?.photo ?? '')
    setActive(manager?.active ?? true)
  }

  const isPending = createManager.isPending || updateManager.isPending || deleteManager.isPending

  async function handleSave() {
    try {
      if (manager) {
        await updateManager.mutateAsync({ id: manager.id, input: { name, phone, contact, photo, active } })
      } else {
        await createManager.mutateAsync({ direction, name, phone, contact, photo, active })
      }
      toast.success('Менеджер сохранён')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось сохранить менеджера')
    }
  }

  async function handleDelete() {
    if (!manager) return
    try {
      await deleteManager.mutateAsync(manager.id)
      toast.success('Менеджер удалён')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось удалить менеджера')
    }
  }

  return (
    <div className="grid gap-4 rounded-2xl border border-border bg-input/10 p-4">
      <div className="flex items-center justify-between">
        <Typography variant="label">{directionLabels[direction]}</Typography>
        {manager ? (
          <Badge variant={manager.active ? 'default' : 'secondary'}>
            {manager.active ? 'активен' : 'выключен'}
          </Badge>
        ) : (
          <Badge variant="outline">не задан</Badge>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Имя" value={name} onChange={setName} required />
        <TextField label="Телефон" value={phone} onChange={setPhone} />
        <TextField label="Контакт (мессенджер)" value={contact} onChange={setContact} />
        <TextField label="Фото (URL)" value={photo} onChange={setPhoto} />
      </div>
      <SwitchField label="Активен" checked={active} onChange={setActive} />
      <div className="flex justify-end gap-2">
        {manager && (
          <Button variant="outline" disabled={isPending} onClick={() => void handleDelete()}>
            Удалить
          </Button>
        )}
        <Button disabled={isPending || name.trim().length < 2} onClick={() => void handleSave()}>
          {manager ? 'Сохранить' : 'Добавить'}
        </Button>
      </div>
    </div>
  )
}
