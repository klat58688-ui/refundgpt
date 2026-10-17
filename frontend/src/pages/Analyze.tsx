import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, RefundRequest } from '../api'

export default function Analyze() {
  const { id } = useParams()
  const [r, setR] = useState<RefundRequest | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [override, setOverride] = useState(false)
  const [confirm, setConfirm] = useState<null | 'full_refund' | 'partial_refund'>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const THRESHOLD = 100 // keep in sync with backend AUTO_REFUND_THRESHOLD

  const load = () => api.get(Number(id)).then((x) => {
    setR(x)
    const rec = x.ai_analysis?.recommendation
    setAmount(String(x.merchant_decision?.amount ?? rec?.amount ?? x.amount ?? ''))
  }).catch((e) => setError(e.message))

  useEffect(() => { load() }, [id])

  if (error && !r) return <div className="p-8 text-red-600">{error}</div>
  if (!r) return <div className="p-8 text-gray-400">Loading…</div>

  const a = r.ai_analysis
  const actionable = r.status === 'analyzed' || r.status === 'pending'
  const amtNum = Number(amount)
  const amountInvalid = !amount || isNaN(amtNum) || amtNum <= 0 || (r.amount != null && amtNum > r.amount)
  const needsOverride = !amountInvalid && amtNum > THRESHOLD

  const openConfirm = (action: 'full_refund' | 'partial_refund') => {
    if (action === 'partial_refund' && amountInvalid) {
      setError(`Partial refund needs a valid amount (0 < amount ≤ ${r.amount ?? 'original'})`)
      return
    }
    setError('')
    setConfirm(action)
  }

  const decide = async (action: string, amt?: number) => {
    setBusy(true); setError('')
    try {
      await api.decide(r.id, action, amt, note, override)
      await load()
    } catch (e: any) { setError(e.message) } finally { setBusy(false); setConfirm(null) }
  }

  const execute = async () => {
    setBusy(true); setError('')
    try {
      await api.execute(r.id)
      await load()
    } catch (e: any) { setError(e.message) } finally { setBusy(false); setConfirm(null) }
  }

  const reanalyze = async () => {
    setBusy(true); setError('')
    try {
      await api.reanalyze(r.id)
      await load()
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen">
      <header className="bg-paypal px-8 py-4 text-white flex items-center gap-4">
        <Link to="/dashboard" className="opacity-80 hover:opacity-100">← Back</Link>
        <h1 className="text-lg font-semibold">Refund #{r.id} {r.order_id && `· ${r.order_id}`}</h1>
        <span className="ml-auto text-sm capitalize bg-white/20 px-3 py-1 rounded-full">{r.status}</span>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-3 gap-5">
        {/* left: conversation */}
        <section className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold mb-3">Customer Conversation</h2>
          <p className="text-sm whitespace-pre-wrap text-gray-700">{r.raw_conversation}</p>
          <div className="mt-4 text-xs text-gray-400">
            {r.customer_email && <div>{r.customer_email}</div>}
            {r.paypal_capture_id ? <div>Capture: {r.paypal_capture_id}</div> : <div>No PayPal capture ID</div>}
          </div>
        </section>

        {/* middle: AI analysis */}
        <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <h2 className="font-semibold">AI Analysis</h2>
          {!a && (
            <div className="space-y-2">
              {r.analysis_error
                ? <p className="text-sm text-red-600">Analysis failed: {r.analysis_error}</p>
                : <p className="text-sm text-gray-400">Not analyzed yet.</p>}
              <button disabled={busy} onClick={reanalyze}
                className="text-sm border border-paypal text-paypal px-3 py-1.5 rounded-lg hover:bg-paypal-light disabled:opacity-50">
                {busy ? 'Analyzing…' : 'Run AI Analysis'}
              </button>
            </div>
          )}
          {a && (
            <>
              <div className="flex gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-paypal-light text-paypal-dark">{a.issue_type}</span>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100">
                  confidence {(a.recommendation.confidence * 100).toFixed(0)}%
                </span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${a.policy_match.eligible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {a.policy_match.eligible ? `eligible ${a.policy_match.refund_percentage}%` : 'not eligible'}
                </span>
              </div>

              {a.contradictions.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-red-700">⚠ Contradictions detected</div>
                  <ul className="text-sm text-red-600 list-disc ml-5 mt-1">
                    {a.contradictions.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}

              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Claims</div>
                <ul className="text-sm list-disc ml-5 text-gray-700">{a.customer_claims.map((c, i) => <li key={i}>{c}</li>)}</ul>
              </div>
              {a.evidence_mentioned.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Evidence mentioned</div>
                  <ul className="text-sm list-disc ml-5 text-gray-700">{a.evidence_mentioned.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </div>
              )}
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Policy match</div>
                <p className="text-sm text-gray-700">{a.policy_match.reason}</p>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">AI reasoning</div>
                <p className="text-sm text-gray-700">{a.recommendation.reasoning}</p>
              </div>
              {a.next_steps.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Suggested next steps</div>
                  <ul className="text-sm list-disc ml-5 text-gray-700">{a.next_steps.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
            </>
          )}
        </section>

        {/* right: action */}
        <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <h2 className="font-semibold">Refund Decision</h2>
          {a && (
            <div className="bg-paypal-light rounded-lg p-3 text-sm">
              AI suggests: <b>{a.recommendation.action.replace('_', ' ')}</b> ${a.recommendation.amount.toFixed(2)}
            </div>
          )}
          <label className="block text-sm">
            <span className="text-gray-600">Amount ({r.currency})</span>
            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full border rounded-lg p-2 focus:ring-2 focus:ring-paypal focus:outline-none" />
          </label>
          {needsOverride && (
            <label className="flex items-start gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg p-2">
              <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="mt-1" />
              Amount exceeds the ${THRESHOLD} auto-approval threshold — I confirm this manually.
            </label>
          )}
          <label className="block text-sm">
            <span className="text-gray-600">Note to customer</span>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full border rounded-lg p-2 focus:ring-2 focus:ring-paypal focus:outline-none" />
          </label>
          {error && <div className="text-sm text-red-600">{error}</div>}

          {actionable && (
            <div className="space-y-2">
              <button disabled={busy} onClick={() => openConfirm('full_refund')}
                className="w-full bg-paypal text-white py-2 rounded-lg font-medium hover:bg-paypal-dark disabled:opacity-50">
                Approve Full Refund
              </button>
              <button disabled={busy} onClick={() => openConfirm('partial_refund')}
                className="w-full border border-paypal text-paypal py-2 rounded-lg font-medium hover:bg-paypal-light disabled:opacity-50">
                Approve Partial Refund
              </button>
              <button disabled={busy} onClick={() => decide('reject')}
                className="w-full text-red-600 py-2 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50">
                Reject Request
              </button>
            </div>
          )}
          {r.status === 'approved' && (
            <button disabled={busy} onClick={() => setConfirm('full_refund')}
              className="w-full bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
              Execute via PayPal →
            </button>
          )}
          {r.status === 'executed' && (
            <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">
              Refunded ✓ {r.paypal_refund_id && <span className="block text-xs mt-1">PayPal refund: {r.paypal_refund_id}</span>}
            </div>
          )}
        </section>
      </main>

      {/* confirm modal */}
      {confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setConfirm(null)}>
          <div className="bg-white rounded-2xl p-6 w-96 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Confirm Refund</h3>
            <div className="mt-3 text-sm space-y-1 text-gray-700">
              <div>Order: <b>{r.order_id ?? '—'}</b></div>
              <div>Amount: <b>${Number(amount || 0).toFixed(2)} {r.currency}</b></div>
              <div>Type: <b>{confirm.replace('_', ' ')}</b></div>
              <div className="text-xs text-gray-400 pt-2">
                {r.status === 'approved'
                  ? 'This will call the PayPal Refund API immediately.'
                  : 'Merchant approval first; you will execute via PayPal in the next step.'}
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setConfirm(null)} className="flex-1 border rounded-lg py-2">Cancel</button>
              <button disabled={busy || (needsOverride && !override)}
                onClick={() => (r.status === 'approved'
                  ? execute()
                  : decide(confirm, confirm === 'full_refund' ? (r.amount ?? amtNum) : amtNum))}
                className="flex-1 bg-paypal text-white rounded-lg py-2 font-medium hover:bg-paypal-dark disabled:opacity-50">
                {busy ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
