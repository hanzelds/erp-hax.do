import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { AxiosError } from 'axios'

// ── Generic helpers ───────────────────────────────────────────

export function useGet<T>(key: string[], url: string, params?: object, enabled = true) {
  return useQuery<T, AxiosError>({
    queryKey: [...key, params],
    queryFn: async () => {
      const { data } = await api.get(url, { params })
      return data
    },
    enabled,
  })
}

export function usePost<TBody, TResult = unknown>(
  url: string,
  invalidate?: string[][]
) {
  const qc = useQueryClient()
  return useMutation<TResult, AxiosError, TBody>({
    mutationFn: async (body) => {
      const { data } = await api.post(url, body)
      return data
    },
    onSuccess: () => {
      invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }))
    },
  })
}

export function usePatch<TBody, TResult = unknown>(
  url: string | ((id: string) => string),
  invalidate?: string[][]
) {
  const qc = useQueryClient()
  return useMutation<TResult, AxiosError, { id: string; body: TBody }>({
    mutationFn: async ({ id, body }) => {
      const endpoint = typeof url === 'function' ? url(id) : `${url}/${id}`
      const { data } = await api.patch(endpoint, body)
      return data
    },
    onSuccess: () => {
      invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }))
    },
  })
}

export function useDelete(url: string, invalidate?: string[][]) {
  const qc = useQueryClient()
  return useMutation<void, AxiosError, string>({
    mutationFn: async (id) => {
      await api.delete(`${url}/${id}`)
    },
    onSuccess: () => {
      invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }))
    },
  })
}
