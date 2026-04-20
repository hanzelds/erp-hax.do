import { useState, useEffect, useRef } from 'react'

export interface RncResult {
  cedula_rnc: string
  nombre_razon_social: string
  nombre_comercial: string
  categoria: string
  regimen_de_pagos: string
  estado: string
  actividad_economica: string
  administracion_local: string
  facturador_electronico: string
  rnc_consultado: string
  // convenience alias used by callers
  nombre: string
}

type LookupState = 'idle' | 'loading' | 'found' | 'not_found' | 'error'

/**
 * Debounced RNC/Cédula lookup via rnc.megaplus.com.do.
 * Triggers automatically whenever `rnc` reaches ≥ 9 digits.
 *
 * @param rnc        — current RNC/cédula string (may contain dashes/spaces)
 * @param onFound    — called with the result when a match is found
 * @param debounceMs — delay after the user stops typing (default 600 ms)
 */
export function useRncLookup(
  rnc: string,
  onFound: (result: RncResult) => void,
  debounceMs = 600
) {
  const [state, setState] = useState<LookupState>('idle')
  const onFoundRef = useRef(onFound)
  onFoundRef.current = onFound   // always call the latest version

  useEffect(() => {
    const digits = rnc.replace(/\D/g, '')
    if (digits.length < 9) {
      setState('idle')
      return
    }

    setState('loading')
    const timer = setTimeout(async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
        const res = await fetch(`${base}/rnc-lookup?rnc=${digits}`)

        const json = await res.json()

        if (json.error === false && json.nombre_razon_social) {
          const result: RncResult = {
            ...json,
            nombre: json.nombre_razon_social,   // convenience alias
          }
          setState('found')
          onFoundRef.current(result)
        } else {
          // 404 or error:true
          setState('not_found')
        }
      } catch {
        setState('error')
      }
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [rnc, debounceMs])

  return {
    /** 'idle' | 'loading' | 'found' | 'not_found' | 'error' */
    state,
    isLoading:  state === 'loading',
    isFound:    state === 'found',
    isNotFound: state === 'not_found',
  }
}
