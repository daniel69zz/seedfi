/* oxlint-disable react/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { demoUsers } from '../../../shared/data/platform.mock'
import type { DemoUser, KycStatus, UserRole } from '../../../shared/types/platform.types'

interface RegisterInput {
  name: string
  email: string
  role: 'INVESTOR' | 'COMPANY'
  companyName?: string
}

interface AuthContextValue {
  user: DemoUser | null
  isAuthenticated: boolean
  login: (email: string) => DemoUser | null
  register: (input: RegisterInput) => DemoUser
  logout: () => void
  updateKycStatus: (status: KycStatus) => void
}

const STORAGE_KEY = 'seedfi.demo.session'
const AuthContext = createContext<AuthContextValue | null>(null)

function readSession(): DemoUser | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value ? JSON.parse(value) as DemoUser : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<DemoUser | null>(readSession)

  useEffect(() => {
    if (user) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    else window.localStorage.removeItem(STORAGE_KEY)
  }, [user])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: Boolean(user),
    login(email) {
      const demoUser = demoUsers.find((candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase()) ?? null
      if (demoUser) setUser(demoUser)
      return demoUser
    },
    register(input) {
      const nextUser: DemoUser = {
        id: `usr-${Date.now()}`,
        name: input.name,
        email: input.email,
        role: input.role,
        companyName: input.companyName,
        kycStatus: input.role === 'INVESTOR' ? 'IN_PROGRESS' : undefined,
        kybStatus: input.role === 'COMPANY' ? 'INCOMPLETE' : undefined,
      }
      setUser(nextUser)
      return nextUser
    },
    logout() { setUser(null) },
    updateKycStatus(status) {
      setUser((current) => current ? { ...current, kycStatus: status } : current)
    },
  }), [user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider')
  return context
}

export function getRoleHome(role: UserRole) {
  if (role === 'ADMIN') return '/admin'
  if (role === 'COMPANY') return '/company/dashboard'
  return '/investor/dashboard'
}
