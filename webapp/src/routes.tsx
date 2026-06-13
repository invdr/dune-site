import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'

import { AdminShell } from './pages/admin-shell'
import { ComplexesListPage } from './pages/complexes-list'
import { EditComplexPage, NewComplexPage } from './pages/complex-editor'
import { HomeContentPage } from './pages/home-content-page'
import { LeadsPage } from './pages/leads-page'
import { EditObjectPage, NewObjectPage } from './pages/object-editor'
import { ObjectsListPage } from './pages/objects-list'
import { SettingsPage } from './pages/settings-page'

const rootRoute = createRootRoute({
  component: AdminShell,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  // The dashboard entry point is the objects catalog.
  beforeLoad: () => {
    throw redirect({ to: '/objects' })
  },
})

const objectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/objects',
  component: ObjectsListPage,
})

const newObjectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/objects/new',
  component: NewObjectPage,
})

const editObjectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/objects/$propertyId',
  component: EditObjectPage,
})

const complexesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/complexes',
  component: ComplexesListPage,
})

const newComplexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/complexes/new',
  component: NewComplexPage,
})

const editComplexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/complexes/$complexId',
  component: EditComplexPage,
})

const homeContentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/home-content',
  component: HomeContentPage,
})

const leadsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/leads',
  component: LeadsPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  objectsRoute,
  newObjectRoute,
  editObjectRoute,
  complexesRoute,
  newComplexRoute,
  editComplexRoute,
  homeContentRoute,
  leadsRoute,
  settingsRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
