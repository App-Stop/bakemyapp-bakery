import { rowsOf } from '../../lib/records'
import { useState } from 'react'
import { tenant, dateTime, money } from '../../lib/tenant'
import { useRemote } from '../../lib/useRemote'
import { useTenant } from '../../lib/TenantContext'
import { CatalogModal, CatalogPagination } from '../shared/CatalogUI'
import { ErrorMessage, Field, buttonClass, cardClass, primaryClass } from '../shared/ApiUI'
import { RemoteState, Textarea } from '../shared/WorkspaceUI'

const types = { refund_status: 'Refund status', missing_points: 'Missing points', order_feedback: 'Order feedback' }
export function Tickets() {
  const [status, setStatus] = useState('open')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const remote = useRemote(() => tenant.list('support/tickets', { status, type, page, limit: 10 }), [status, type, page], { poll: 30000 })
  const rows = rowsOf(remote.data?.data, 'tickets')
  return <section className={`${cardClass} workspace-stack`} aria-label="Support requests"><div className="workspace-card-heading"><div><h2>Support requests</h2><p className="workspace-hint">Review customer issues. Sending one reply closes the request.</p></div><button className={buttonClass} disabled={remote.loading} onClick={remote.refresh}>Refresh requests</button></div>
    <div className="page-options-fields"><Field label="Request status"><select className={buttonClass} aria-label="Request status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>{['open', 'closed', 'all'].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select></Field><Field label="Request type"><select className={buttonClass} aria-label="Request type" value={type} onChange={(e) => { setType(e.target.value); setPage(1) }}><option value="">All types</option>{Object.entries(types).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field></div>
    <RemoteState remote={remote} label="support requests" empty={!rows.length}><div className="overflow-x-auto"><table className="module-table"><thead><tr><th>Customer</th><th>Request</th><th>Order</th><th>Status</th><th>Received</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.map((ticket) => <tr key={ticket.id}><td><strong>{ticket.customer?.name || 'Customer'}</strong><p className="workspace-hint">{ticket.customer?.email}</p></td><td>{types[ticket.type] || ticket.type}<p className="workspace-hint line-clamp-2 max-w-xs">{ticket.message}</p></td><td>{ticket.order?.number ? `#${ticket.order.number}` : 'No linked order'}</td><td><span className={`workspace-badge ${ticket.status === 'open' ? '' : 'workspace-badge-muted'}`}>{ticket.status}</span></td><td>{dateTime(ticket.createdAt)}</td><td><button className={buttonClass} onClick={() => setSelected(ticket.id)}>Open request</button></td></tr>)}</tbody></table></div></RemoteState>
    <CatalogPagination pagination={remote.data?.pagination || remote.data?.data?.pagination} page={page} count={rows.length} noun="support requests" onChange={setPage} disabled={remote.loading} />
    {selected && <TicketDetails key={selected} id={selected} onClose={() => setSelected(null)} onAnswered={remote.refresh} />}
  </section>
}
function TicketDetails({ id, onClose, onAnswered }) {
  const { branding } = useTenant()
  const remote = useRemote(() => tenant.get(`support/tickets/${id}`), [id])
  const ticket = remote.data?.data?.ticket || remote.data?.data
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [answered, setAnswered] = useState(false)
  const [notice, setNotice] = useState('')
  const send = async (event) => {
    event.preventDefault(); setBusy(true); setError(null)
    try {
      await tenant.post(`support/tickets/${id}/reply`, { reply: reply.trim() })
      setAnswered(true); setReply(''); setNotice('Reply sent. This request is now closed.')
      await Promise.all([remote.refresh(), onAnswered()])
    } catch (err) {
      setError(err)
      if (err.status === 422) {
        const result = await remote.refresh()
        if ((result?.data?.ticket || result?.data)?.status === 'closed' || /ticket_closed|already answered|already closed/i.test(err.message)) setAnswered(true)
        await onAnswered()
      }
    } finally { setBusy(false) }
  }
  const image = ticket?.image?.url || ticket?.imageUrl || ticket?.picture?.url || ticket?.picture
  const closed = answered || ticket?.status === 'closed' || !!ticket?.reply
  return <CatalogModal title="Support request" wide busy={busy} onClose={onClose}>{notice && <p className="workspace-notice mb-4" role="status">{notice}</p>}<RemoteState remote={remote} label="request details">{ticket && <div className="workspace-stack">
    <div className="workspace-card-heading"><div><h3 className="font-semibold">{types[ticket.type] || ticket.type}</h3><p className="workspace-hint">{ticket.customer?.name} · {ticket.customer?.email}</p><p className="workspace-hint">{dateTime(ticket.createdAt)}</p></div><span className="workspace-badge">{closed ? 'Closed' : 'Open'}</span></div>
    {ticket.order && <div className="workspace-stat"><dt>Linked order</dt><dd>#{ticket.order.number} {ticket.order.total != null && `· ${money(ticket.order.total, ticket.order.currencySymbol || branding?.currencySymbol)}`}</dd></div>}
    <p className="workspace-prose">{ticket.message}</p>{typeof image === 'string' && <a href={image} target="_blank" rel="noreferrer" className="self-start"><img className="workspace-picture" src={image} alt="Customer attachment" /></a>}
    {ticket.reply && <div className="workspace-notice"><strong>Your reply</strong><p className="workspace-prose">{typeof ticket.reply === 'string' ? ticket.reply : ticket.reply.body || ticket.reply.message}</p></div>}
    <ErrorMessage error={error} />
    {!closed && <form onSubmit={send} className="workspace-stack"><Textarea label="Reply to customer" name="reply" value={reply} onChange={(e) => setReply(e.target.value)} maxLength={1000} required disabled={busy} errors={error?.fieldErrors} /><p className="workspace-hint">You can send one reply. Sending it closes this request.</p><button className={`${primaryClass} self-end`} disabled={busy || !reply.trim()}>{busy ? 'Sending…' : 'Send reply & close request'}</button></form>}
  </div>}</RemoteState></CatalogModal>
}
