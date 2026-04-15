import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/lib/api'

interface User {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'ACCOUNTANT'
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean

  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
          const { data } = await api.post('/auth/login', { email, password })
          const { user, accessToken } = data.data

          localStorage.setItem('hax_token', accessToken)
          set({ user, token: accessToken, isAuthenticated: true, isLoading: false })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: () => {
        localStorage.removeItem('hax_token')
        localStorage.removeItem('hax_user')
        set({ user: null, token: null, isAuthenticated: false })
        window.location.href = '/auth/login'
      },

      setUser: (user: User) => set({ user }),
    }),
    {
      name: 'hax_auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
