import { Link, Outlet } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Building03Icon,
  Home09Icon,
  Logout03Icon,
  Mail01Icon,
  Settings02Icon,
} from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Typography } from '@/components/ui/typography'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/use-auth'
import { LoginScreen } from './login-screen'

type NavItem = { to: string; label: string; icon: IconSvgElement }

const navItems: NavItem[] = [
  { to: '/objects', label: 'Объекты', icon: Building03Icon },
  { to: '/home-content', label: 'Главная', icon: Home09Icon },
  { to: '/leads', label: 'Заявки', icon: Mail01Icon },
  { to: '/settings', label: 'Настройки', icon: Settings02Icon },
]

const navLinkClass = cn(
  buttonVariants({ variant: 'ghost', size: 'sm' }),
  'w-full justify-start gap-2 text-muted-foreground data-[status=active]:bg-secondary data-[status=active]:text-secondary-foreground data-[status=active]:hover:bg-secondary/80 data-[status=active]:hover:text-secondary-foreground',
)

export function AdminShell() {
  const auth = useAuth()

  if (auth.isBootstrapping) {
    return (
      <main className="grid min-h-svh place-items-center bg-background">
        <Card className="w-fit">
          <CardContent className="flex items-center gap-3">
            <Spinner />
            <Typography variant="bodySm" tone="muted">
              Проверяем сессию…
            </Typography>
          </CardContent>
        </Card>
      </main>
    )
  }

  // The layout is the single auth gate: every admin route renders inside it, so
  // an unauthenticated visitor only ever sees the login screen.
  if (!auth.isAuthenticated) {
    return <LoginScreen />
  }

  return (
    <div className="min-h-svh bg-background text-foreground lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-4 border-b bg-card px-4 py-5 lg:sticky lg:top-0 lg:h-svh lg:border-r lg:border-b-0">
        <Link to="/objects" className="px-2">
          <Typography variant="h6">DUNE admin</Typography>
        </Link>
        <nav className="flex flex-wrap gap-1 lg:flex-col" aria-label="Разделы">
          {navItems.map((item) => (
            <Link key={item.to} to={item.to} className={navLinkClass}>
              <HugeiconsIcon icon={item.icon} strokeWidth={2} className="size-4" aria-hidden />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto hidden gap-2 lg:grid">
          <Typography variant="bodyXs" tone="muted" wrap="break" className="px-2">
            {auth.user?.email}
          </Typography>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-start gap-2"
            onClick={() => void auth.logout()}
          >
            <HugeiconsIcon icon={Logout03Icon} strokeWidth={2} className="size-4" aria-hidden />
            Выйти
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto gap-2 lg:hidden"
          onClick={() => void auth.logout()}
        >
          <HugeiconsIcon icon={Logout03Icon} strokeWidth={2} className="size-4" aria-hidden />
          Выйти
        </Button>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
