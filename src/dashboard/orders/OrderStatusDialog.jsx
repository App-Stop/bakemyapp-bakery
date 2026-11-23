import { useState } from 'react'
import { can, tenant } from '../../lib/tenant'
import { useTenant } from '../../lib/TenantContext'
import { useRemote } from '../../lib/useRemote'
import { Modal, Field, ErrorMessage, buttonClass, primaryClass } from '../shared/ApiUI'
import { actionLabel } from './orderHelpers'

export function OrderStatusDialog({ action: { order, status }, onSubmit, onClose }) {
  const { user } = useTenant()
  const [reason, setReason] = useState('')
  const [readyInMinutes, setMinutes] = useState('')
  const [riderId, setRiderId] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const riders = useRemote(async () => {
    if (status !== 'out_for_delivery' || !can(user, 'team:view') || !order.branch?.id) return null
    let page = 1; const people = []
    while (true) {
      const result = await tenant.list('team', { role: 'rider', branchId: order.branch.id, status: 'active', page, limit: 100 })
      people.push(...result.data)
      if (page >= (result.pagination?.totalPages || 1)) break
      page++
    }
    return people
  }, [status, order.branch?.id, user.id])
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError(null)
    try { await onSubmit({ ...(status === 'cancelled' ? { reason: reason.trim() } : {}), ...(status === 'accepted' && readyInMinutes !== '' ? { readyInMinutes: Number(readyInMinutes) } : {}), ...(status === 'out_for_delivery' && riderId ? { riderId } : {}) }) } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return <Modal title={`${actionLabel(status, order)} · #${order.number}`} onClose={onClose} busy={busy}><form onSubmit={save} className="flex flex-col gap-4"><ErrorMessage error={error} />{status === 'cancelled' && <><p className="text-sm text-muted">The customer will receive this reason. Paid card orders are refunded automatically.</p><div className="flex flex-wrap gap-2">{['Out of stock', 'Too busy', 'Unable to deliver'].map((text) => <button key={text} type="button" className={buttonClass} onClick={() => setReason(text)}>{text}</button>)}</div><Field label="Why are you cancelling?" name="reason" minLength={3} maxLength={200} required value={reason} errors={error?.fieldErrors} onChange={(event) => setReason(event.target.value)} /></>}{status === 'accepted' && <Field label="Ready in minutes (optional; blank uses branch default)" name="readyInMinutes" type="number" min="1" max="720" step="1" value={readyInMinutes} errors={error?.fieldErrors} onChange={(event) => setMinutes(event.target.value)} />}{status === 'out_for_delivery' && can(user, 'team:view') && <><ErrorMessage error={riders.error} /><Field label="Rider (optional)" name="riderId" errors={error?.fieldErrors}><select className={buttonClass} value={riderId} onChange={(event) => setRiderId(event.target.value)} disabled={riders.loading}><option value="">No rider assigned</option>{riders.data?.map((rider) => <option key={rider.id} value={rider.id}>{rider.name}</option>)}</select></Field></>}<button className={primaryClass} disabled={busy || (status === 'cancelled' && reason.trim().length < 3)}>{busy ? 'Saving…' : actionLabel(status, order)}</button></form></Modal>
}
