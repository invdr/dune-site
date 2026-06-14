import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AdminComplexListQuery,
  AdminPropertyListQuery,
  CreateComplexRequest,
  CreateManagerRequest,
  CreatePropertyRequest,
  UpdateComplexRequest,
  LeadListQuery,
  UpdateHomeContentRequest,
  UpdateLeadRequest,
  UpdateManagerRequest,
  UpdatePropertyRequest,
  UpdateSiteSettingsRequest,
} from '@dune/contracts'

import { useAuth } from './use-auth'

// Centralized query keys so mutations can invalidate precisely.
export const adminKeys = {
  properties: (query: Partial<AdminPropertyListQuery>) => ['admin', 'properties', query] as const,
  property: (id: string) => ['admin', 'property', id] as const,
  complexes: (query: Partial<AdminComplexListQuery>) => ['admin', 'complexes', query] as const,
  complex: (id: string) => ['admin', 'complex', id] as const,
  leads: (query: Partial<LeadListQuery>) => ['admin', 'leads', query] as const,
  managers: () => ['admin', 'managers'] as const,
  settings: () => ['admin', 'settings'] as const,
  home: () => ['admin', 'home'] as const,
}

// --- Properties ---

export function useProperties(query: Partial<AdminPropertyListQuery>) {
  const { api } = useAuth()
  return useQuery({
    queryKey: adminKeys.properties(query),
    queryFn: () => api.listProperties(query),
    placeholderData: (previous) => previous,
  })
}

export function useProperty(id: string | undefined) {
  const { api } = useAuth()
  return useQuery({
    queryKey: adminKeys.property(id ?? ''),
    queryFn: () => api.getProperty(id as string),
    enabled: Boolean(id),
  })
}

export function useCreateProperty() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePropertyRequest) => api.createProperty(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'properties'] }),
  })
}

export function useUpdateProperty(id: string) {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdatePropertyRequest) => api.updateProperty(id, input),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'properties'] })
      queryClient.setQueryData(adminKeys.property(id), response)
    },
  })
}

export function useDeleteProperty() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteProperty(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'properties'] }),
  })
}

// --- Complexes (ЖК) ---

export function useComplexes(query: Partial<AdminComplexListQuery>) {
  const { api } = useAuth()
  return useQuery({
    queryKey: adminKeys.complexes(query),
    queryFn: () => api.listComplexes(query),
    placeholderData: (previous) => previous,
  })
}

export function useComplex(id: string | undefined) {
  const { api } = useAuth()
  return useQuery({
    queryKey: adminKeys.complex(id ?? ''),
    queryFn: () => api.getComplex(id as string),
    enabled: Boolean(id),
  })
}

export function useCreateComplex() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateComplexRequest) => api.createComplex(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'complexes'] }),
  })
}

export function useUpdateComplex(id: string) {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateComplexRequest) => api.updateComplex(id, input),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'complexes'] })
      queryClient.setQueryData(adminKeys.complex(id), response)
    },
  })
}

export function useDeleteComplex() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteComplex(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'complexes'] }),
  })
}

export function useBulkCreateComplexes() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.bulkCreateComplexes(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'complexes'] }),
  })
}

// --- Leads ---

export function useLeads(query: Partial<LeadListQuery>) {
  const { api } = useAuth()
  return useQuery({
    queryKey: adminKeys.leads(query),
    queryFn: () => api.listLeads(query),
    placeholderData: (previous) => previous,
  })
}

export function useUpdateLead() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLeadRequest }) =>
      api.updateLead(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] }),
  })
}

// --- Managers ---

export function useManagers() {
  const { api } = useAuth()
  return useQuery({
    queryKey: adminKeys.managers(),
    queryFn: () => api.listManagers(),
  })
}

export function useCreateManager() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateManagerRequest) => api.createManager(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.managers() }),
  })
}

export function useUpdateManager() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateManagerRequest }) =>
      api.updateManager(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.managers() }),
  })
}

export function useDeleteManager() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteManager(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.managers() }),
  })
}

// --- Site settings ---

export function useSettings() {
  const { api } = useAuth()
  return useQuery({
    queryKey: adminKeys.settings(),
    queryFn: () => api.getSettings(),
  })
}

export function useUpdateSettings() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateSiteSettingsRequest) => api.updateSettings(input),
    onSuccess: (response) => queryClient.setQueryData(adminKeys.settings(), response),
  })
}

// --- Home content ---

export function useHomeContent() {
  const { api } = useAuth()
  return useQuery({
    queryKey: adminKeys.home(),
    queryFn: () => api.getHomeContent(),
  })
}

export function useUpdateHomeContent() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateHomeContentRequest) => api.updateHomeContent(input),
    onSuccess: (response) => queryClient.setQueryData(adminKeys.home(), response),
  })
}
