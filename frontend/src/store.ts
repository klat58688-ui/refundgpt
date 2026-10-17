import { create } from 'zustand'
import { api, RefundRequest, Stats } from './api'

interface State {
  requests: RefundRequest[]
  stats: Stats | null
  loading: boolean
  error: string | null
  refresh: (status?: string) => Promise<void>
}

export const useStore = create<State>((set) => ({
  requests: [],
  stats: null,
  loading: false,
  error: null,
  refresh: async (status) => {
    set({ loading: true, error: null })
    try {
      const [requests, stats] = await Promise.all([api.list(status), api.stats()])
      set({ requests, stats, loading: false })
    } catch (e: any) {
      set({ loading: false, error: e.message })
    }
  },
}))
