import { useState } from 'react'
import { tenant, money } from '../../lib/tenant'
import { useRemote } from '../../lib/useRemote'
import { ErrorMessage, Field, buttonClass, primaryClass } from '../shared/ApiUI'
import { RemoteState, Textarea } from '../shared/WorkspaceUI'
import { walletCreditBody } from './loyaltyHelpers'

export function WalletCreditForm({ customer, symbol, onCancel, onCredited, onBusy, onNavigate }) {
  const rules = useRemote(() => tenant.get('loyalty'), [])
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [review, setReview] = useState(null)
  const [error, setError] = useState(null)
  const [uncertain, setUncertain] = useState(false)
  const [busy, setBusy] = useState(false)
  const submit = async (event) => {
    event.preventDefault(); setError(null)
    if (!review) { try { setReview(walletCreditBody(amount, reason)) } catch (err) { setError(err) } return }
    if (busy || uncertain) return
    setBusy(true); onBusy(true)
    try { await tenant.post(`loyalty/customers/${customer.id}/wallet-credit`, review); await onCredited() } catch (err) {
      setError(err)
      if (!err.status || err.status >= 500) setUncertain(true)
      else { setReview(null); if (err.status === 422) await rules.refresh() }
    } finally { setBusy(false); onBusy(false) }
  }
  return <div className="workspace-stack"><RemoteState remote={rules} label="wallet availability">
    {rules.data?.data?.walletEnabled ? <form className="workspace-stack" onSubmit={submit}><ErrorMessage error={error} />
      {uncertain ? <p className="workspace-warning" role="status">This credit could not be confirmed. Check the customer’s balance and activity log before starting another credit. This request will not be retried automatically.</p> : review ? <div className="workspace-notice"><p>Credit <strong>{money(review.amount, symbol)}</strong> to <strong>{customer.name || customer.email}</strong>?</p><p className="workspace-prose">Reason: {review.reason}</p><p>The customer will see this reason in their wallet history.</p></div> : <><Field autoFocus label={`Credit amount (${symbol})`} name="amount" type="number" min="0.01" step="0.01" value={amount} required errors={error?.fieldErrors} onChange={(e) => setAmount(e.target.value)} /><Textarea label="Reason shown to the customer" name="reason" value={reason} required maxLength={200} errors={error?.fieldErrors} onChange={(e) => setReason(e.target.value)} /></>}
      <div className="workspace-actions justify-end"><button type="button" className={buttonClass} disabled={busy} onClick={() => review && !uncertain ? setReview(null) : onCancel()}>{review && !uncertain ? 'Edit credit' : 'Back to customer'}</button>{!uncertain && <button className={primaryClass} disabled={busy}>{busy ? 'Adding credit…' : review ? 'Confirm wallet credit' : 'Review credit'}</button>}</div>
    </form> : <div className="workspace-stack"><p className="workspace-warning">The customer wallet is switched off. Enable it in Loyalty before adding credit.</p><div className="workspace-actions"><button className={primaryClass} onClick={() => onNavigate?.('loyalty')}>Open loyalty settings</button><button className={buttonClass} onClick={onCancel}>Back to customer</button></div></div>}
  </RemoteState></div>
}
