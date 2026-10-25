import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useStore } from '../store'

const STATUS_FILTERS = ['all', 'pending', 'analyzed', 'executed', 'rejected'] as const

const badge = (s: string) =>
  ({
    pending: 'bg-yellow-100 text-yellow-800',
    analyzed: 'bg-blue-100 text-paypal-dark',
    approved: 'bg-indigo-100 text-indigo-800',
    executed: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    failed: 'bg-red-200 text-red-900',
  }[s] ?? 'bg-gray-100 text-gray-700')

export default function Dashboard() {
  const { requests, stats, refresh, loading, error } = useStore()
  const [filter, setFilter] = useState<string>('all')
  const [text, setText] = useState('')
  const [captureId, setCaptureId] = useState('')
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()

  useEffect(() => { refresh(filter === 'all' ? undefined : filter) }, [filter])

  const submit = async () => {
    if (text.trim().length < 5) return
    setBusy(true)
    try {
      const r = await api.analyze(text, captureId.trim() ? { paypal_capture_id: captureId.trim() } : {})
      setText('')
      setCaptureId('')
      nav(`/analyze/${r.id}`)
    } catch (e: any) {
      alert(`AI analysis failed: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="bg-paypal px-8 py-4 text-white flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">RefundGPT <span className="font-normal opacity-80">— AI Refund Assistant</span></h1>
        <div className="flex items-center gap-4">
          <Link to="/requests" className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition">All Requests (AG Grid)</Link>
          <span className="text-sm opacity-80">PayPal AI Hackathon 2026</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            ['Processed (24h)', stats?.today_processed ?? '—'],
            ['Avg. handling time', stats ? `${Math.round(stats.avg_processing_seconds)}s` : '—'],
            ['Total refunded', stats ? `$${stats.total_refunded.toFixed(2)}` : '—'],
            ['Pending queue', stats?.pending_count ?? '—'],
          ].map(([k, v]) => (
            <div key={k as string} className="bg-white rounded-xl shadow-sm p-5">
              <div className="text-sm text-gray-500">{k}</div>
              <div className="text-3xl font-semibold mt-1">{v}</div>
            </div>
          ))}
        </div>

        {/* new request */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <label className="text-sm font-medium text-gray-600">Paste customer conversation → AI analysis</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
            placeholder="e.g. Hi, my headphones arrived defective, left ear no sound, order PP-12345 $79.99..."
            className="mt-2 w-full rounded-lg border-gray-300 border p-3 text-sm focus:ring-2 focus:ring-paypal focus:outline-none" />
          <div className="mt-2 flex items-center gap-3">
            <input value={captureId} onChange={(e) => setCaptureId(e.target.value)}
              placeholder="PayPal Capture ID (optional — required to execute the refund)"
              className="flex-1 rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-paypal focus:outline-none" />
            <button onClick={submit} disabled={busy}
              className="bg-paypal hover:bg-paypal-dark text-white px-5 py-2 rounded-lg font-medium disabled:opacity-50 transition whitespace-nowrap">
              {busy ? 'Analyzing with AI…' : 'Analyze Refund Request'}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Find the Capture ID in PayPal → Activity → the payment → Capture ID (Sandbox).
          </p>
        </div>

        {/* filters + list */}
        <div className="flex gap-2">
          {STATUS_FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-sm capitalize ${filter === f ? 'bg-paypal text-white' : 'bg-white text-gray-600 border'}`}>
              {f}
            </button>
          ))}
        </div>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
        {loading && <div className="text-gray-400 text-sm">Loading…</div>}

        <div className="space-y-2">
          {requests.map((r) => (
            <Link to={`/analyze/${r.id}`} key={r.id}
              className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between hover:ring-2 hover:ring-paypal-light transition block">
              <div>
                <div className="font-medium">#{r.id} · {r.order_id || 'no order id'} · {r.customer_name || 'unknown'}</div>
                <div className="text-sm text-gray-500 truncate max-w-xl">{r.raw_conversation}</div>
              </div>
              <div className="flex items-center gap-3">
                {r.amount != null && <span className="font-semibold">${r.amount.toFixed(2)}</span>}
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${badge(r.status)}`}>{r.status}</span>
              </div>
            </Link>
          ))}
          {!loading && requests.length === 0 && <div className="text-gray-400 text-sm">No requests.</div>}
        </div>
      </main>
    </div>
  )
}
