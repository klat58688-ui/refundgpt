export interface AIAnalysis {
  order_id?: string
  amount?: number
  issue_type: string
  customer_claims: string[]
  evidence_mentioned: string[]
  contradictions: string[]
  policy_match: { eligible: boolean; refund_percentage: number; reason: string }
  recommendation: { action: 'full_refund' | 'partial_refund' | 'reject'; amount: number; confidence: number; reasoning: string }
  next_steps: string[]
}

export interface RefundRequest {
  id: number
  order_id?: string
  paypal_capture_id?: string
  amount?: number
  currency: string
  customer_name?: string
  customer_email?: string
  raw_conversation: string
  ai_analysis?: AIAnalysis
  analysis_error?: string
  status: 'pending' | 'analyzed' | 'approved' | 'executing' | 'executed' | 'rejected' | 'failed'
  merchant_decision?: { action: string; amount?: number; note?: string }
  paypal_refund_id?: string
  created_at: string
  updated_at: string
}

export interface Stats {
  today_processed: number
  avg_processing_seconds: number
  total_refunded: number
  pending_count: number
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    const detail = body.detail
    // FastAPI validation errors return detail as an array — serialize instead of "[object Object]"
    const msg = typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : r.statusText
    throw new Error(msg)
  }
  return r.json()
}

export const api = {
  list: (status?: string) => req<RefundRequest[]>(`/refunds${status ? `?status=${status}` : ''}`),
  get: (id: number) => req<RefundRequest>(`/refunds/${id}`),
  analyze: (raw_conversation: string, extra: Partial<RefundRequest> = {}) =>
    req<RefundRequest>('/refunds/analyze', { method: 'POST', body: JSON.stringify({ raw_conversation, ...extra }) }),
  reanalyze: (id: number) => req<RefundRequest>(`/refunds/${id}/reanalyze`, { method: 'POST' }),
  decide: (id: number, action: string, amount?: number, note = '', overrideThreshold = false) =>
    req<RefundRequest>(`/refunds/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ action, amount, note, override_threshold: overrideThreshold }),
    }),
  execute: (id: number) => req<RefundRequest>(`/refunds/${id}/execute`, { method: 'POST' }),
  stats: () => req<Stats>('/stats'),
}
