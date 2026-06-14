import { createContext } from 'react'
import type { LoginRequest, RegisterRequest, UserDto } from '@dune/contracts'

import type { ApiClient } from './api'

export type AuthContextValue = {
  user: UserDto | null
  isBootstrapping: boolean
  isAuthenticated: boolean
  // The authenticated API client, used by admin query/mutation hooks.
  api: ApiClient
  register: (input: RegisterRequest) => Promise<void>
  login: (input: LoginRequest) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
