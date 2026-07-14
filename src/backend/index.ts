// Backend selection (SPEC §7.2): a Supabase URL + anon key at build time
// selects the production adapter; otherwise the in-browser demo adapter.
import { useCallback, useEffect, useState } from 'react'
import type { Backend } from './types'
import { createLocalBackend } from './local'
import { createSupabaseBackend } from './supabase'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const backend: Backend =
  url && anonKey ? createSupabaseBackend(url, anonKey) : createLocalBackend()

export interface Query<T> {
  data: T | undefined
  error: string | null
  loading: boolean
  reload: () => void
}

// Minimal data hook: re-runs on backend change events (store mutations,
// realtime) and on manual reload. Fine at community scale; swap for a
// query library if the app grows.
export function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[] = []): Query<T> {
  const [state, setState] = useState<{ data?: T; error: string | null; loading: boolean }>({
    error: null,
    loading: true,
  })
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => backend.subscribe(reload), [reload])

  useEffect(() => {
    let live = true
    fetcher().then(
      (data) => live && setState({ data, error: null, loading: false }),
      (e: Error) => live && setState((s) => ({ ...s, error: e.message, loading: false }))
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps])

  return { data: state.data, error: state.error, loading: state.loading, reload }
}
