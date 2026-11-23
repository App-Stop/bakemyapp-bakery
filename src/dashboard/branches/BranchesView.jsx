import { useState } from 'react'
import { can, dateTime, money, tenant } from '../../lib/tenant'
import { useTenant } from '../../lib/TenantContext'
import { useRemote } from '../../lib/useRemote'
import { buttonClass, primaryClass, cardClass, ErrorMessage } from '../shared/ApiUI'
import { BranchForm, BranchHours } from './BranchForm'

function BranchOrderCount({ id }) {
  const summary = useRemote(() => tenant.list('orders/summary', { branchId: id }), [id], { poll: 20000 })
  return <div className="text-sm"><span>{summary.data?.data?.active ?? '—'} active orders</span><ErrorMessage error={summary.error} /></div>
}

export function BranchesView({ onNavigateToOrders }) {
  const { user, branding } = useTenant()
  const editable = can(user, 'branches:edit')
  const [status, setStatus] = useState('active')
  const [q, setQ] = useState('')
  const [editor, setEditor] = useState(null)
  const [hours, setHours] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const list = useRemote(() => tenant.list('branches', { status, q }), [status, q])
  const plan = useRemote(() => can(user, 'plan:view') ? tenant.get('plan') : Promise.resolve(null), [user.id])
  const usage = plan.data?.data?.usage?.branches
  const mutate = async (action) => {
    setBusy(true); setError(null)
    try { await action(); await list.refresh(); await plan.refresh() } catch (err) { setError(err) } finally { setBusy(false) }
  }
  const edit = (branch) => mutate(async () => setEditor((await tenant.get(`branches/${branch.id}`)).data))
  return <div className="mx-auto flex max-w-[1360px] flex-col gap-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-[28px] font-semibold">Branches</h1><p className="text-sm text-muted">Manage your bakery locations, opening hours and ordering.</p>{usage && <p className="mt-2 text-sm">{usage.used} of {usage.limit ?? 'unlimited'} branches used</p>}</div>{editable && <button className={primaryClass} onClick={() => setEditor({})} disabled={usage?.limit != null && usage.used >= usage.limit}>Add Branch</button>}</div>
    {usage?.limit != null && usage.used >= usage.limit && <p className="text-sm text-amber-800">Your plan allows {usage.limit} branches. Contact us to add more.</p>}
    <div className="flex flex-wrap gap-3">{['active', 'inactive', 'all'].map((tab) => <button key={tab} className={status === tab ? primaryClass : buttonClass} onClick={() => setStatus(tab)}>{tab === 'all' ? 'All Branches' : tab === 'active' ? 'Active' : 'Inactive'}</button>)}<input aria-label="Search branches" className="rounded-full border border-[#e8e8e8] bg-white px-4 py-2" placeholder="Search name, area or city" value={q} onChange={(event) => setQ(event.target.value)} /><button className={buttonClass} onClick={list.refresh}>Refresh</button></div>
    <ErrorMessage error={error || list.error || plan.error} />
    {list.loading && <p role="status">Loading branches…</p>}
    {!list.loading && !list.error && !list.data?.data?.length && <p className={cardClass}>No branches found.</p>}
    <div className="grid gap-5 xl:grid-cols-2">{list.data?.data?.map((branch) => <article key={branch.id} className={`${cardClass} flex flex-col gap-4`}>
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{branch.name}</h2><span className={`rounded-full px-3 py-1 text-xs font-semibold ${branch.status === 'open' ? 'bg-green-50 text-green-700' : branch.status === 'paused' ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>{branch.status === 'inactive' ? 'Switched off' : branch.status}</span></div>
      <p className="text-sm text-muted">{[branch.addressLine1, branch.addressLine2, branch.area, branch.city].filter(Boolean).join(', ')}<br />{branch.phone}</p>
      <div className="flex flex-wrap gap-3 text-sm">{branch.acceptsDelivery && <span>Delivery · {money(branch.deliveryFee, branding?.currencySymbol)}</span>}{branch.acceptsPickup && <span>Pickup</span>}<span>Minimum {money(branch.minimumOrder, branding?.currencySymbol)}</span><span>Ready in about {branch.prepTimeMinutes} min</span></div>
      {can(user, 'orders:view') && <BranchOrderCount id={branch.id} />}
      {branch.pausedAt && !branch.isAcceptingOrders && <p className="text-xs text-amber-800">Paused since {dateTime(branch.pausedAt)}</p>}
      <div className="flex flex-wrap gap-2">{editable && <><button className={buttonClass} disabled={busy} onClick={() => edit(branch)}>Edit</button><button className={buttonClass} disabled={busy} onClick={() => mutate(async () => setHours((await tenant.get(`branches/${branch.id}`)).data))}>Opening hours</button>{branch.isActive ? <><button className={buttonClass} disabled={busy} onClick={() => { const paused = branch.isAcceptingOrders; if (!paused || window.confirm(`Customers will not be able to order from ${branch.name} until you resume orders.`)) mutate(() => tenant.post(`branches/${branch.id}/pause`, { paused })) }}>{branch.isAcceptingOrders ? 'Pause orders' : 'Resume orders'}</button><button className={buttonClass} disabled={busy} onClick={() => { if (window.confirm(`Switch off ${branch.name}? Its history will be kept.`)) mutate(() => tenant.delete(`branches/${branch.id}`)) }}>Switch off</button></> : <button className={buttonClass} disabled={busy} onClick={() => mutate(() => tenant.patch(`branches/${branch.id}`, { isActive: true }))}>Switch on</button>}</>}<button className={buttonClass} onClick={() => onNavigateToOrders(branch.id)}>View orders</button></div>
    </article>)}</div>
    {editor && <BranchForm key={editor.id || 'new'} branch={editor} onClose={() => setEditor(null)} onSaved={async (branch, created) => { setEditor(null); if (created) setHours(branch); await list.refresh(); await plan.refresh() }} />}
    {hours && <BranchHours key={hours.id} branch={hours} editable={editable} onClose={() => setHours(null)} onSaved={list.refresh} />}
  </div>
}
