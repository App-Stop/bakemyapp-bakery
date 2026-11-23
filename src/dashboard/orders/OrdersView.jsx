import { useState } from 'react'
import { can, dateTime, money, tenant } from '../../lib/tenant'
import { useTenant } from '../../lib/TenantContext'
import { useRemote } from '../../lib/useRemote'
import { buttonClass, primaryClass, cardClass, ErrorMessage, Pagination, Field } from '../shared/ApiUI'
import { OrderDetailsDrawer } from './OrderDetailsDrawer'
import { OrderStatusDialog } from './OrderStatusDialog'
import { actionLabel, statusLabels } from './orderHelpers'

export function OrdersView({ initialBranchId = '' }) {
  const { user } = useTenant()
  const [filters, setFilters] = useState({ status: 'active', branchId: initialBranchId, q: '', fulfilment: '', paymentMethod: '', paymentStatus: '', from: '', to: '', sort: 'oldest' })
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState(null)
  const [action, setAction] = useState(null)
  const [revision, setRevision] = useState(0)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const branchStaff = user.role === 'branch_staff'
  const editable = can(user, 'orders:manage')
  const list = useRemote(() => tenant.list('orders', { ...filters, ...(branchStaff ? { branchId: undefined } : {}), page, limit: 10 }), [JSON.stringify(filters), page], { poll: 20000 })
  const summary = useRemote(() => tenant.list('orders/summary', branchStaff ? {} : { branchId: filters.branchId }), [filters.branchId], { poll: 20000 })
  const branches = useRemote(() => can(user, 'branches:view') ? tenant.list('branches', { status: 'all' }) : Promise.resolve(null), [user.id])
  const change = (name, value) => { setFilters((previous) => ({ ...previous, [name]: value })); setPage(1) }
  const refresh = async () => { await Promise.all([list.refresh(), summary.refresh()]); setRevision((value) => value + 1) }
  const transition = async (order, status, extra = {}) => {
    setBusy(true); setError(null); setNotice('')
    try {
      await tenant.post(`orders/${order.id}/status`, { status, ...extra })
      setAction(null); setNotice(`Order #${order.number}: ${statusLabels[status]}.`)
      await refresh()
    } catch (err) {
      if (err.status === 409 || (err.status === 422 && err.fieldErrors?.status)) {
        setAction(null); setNotice('This order just changed. The latest details have been loaded.'); await refresh()
      } else { setError(err); throw err }
    } finally { setBusy(false) }
  }
  const chooseAction = (order, status) => {
    if (!order.nextStatuses?.includes(status)) return
    if (['accepted', 'cancelled', 'out_for_delivery'].includes(status)) setAction({ order, status })
    else transition(order, status).catch(() => {})
  }
  const renderActions = (order) => editable && <div className="flex flex-wrap gap-2">{order.nextStatuses?.map((status) => <button key={status} className={status === 'cancelled' ? buttonClass : primaryClass} disabled={busy || list.loading} onClick={() => chooseAction(order, status)}>{actionLabel(status, order)}</button>)}</div>
  return <div className="mx-auto flex max-w-[1360px] flex-col gap-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-[28px] font-semibold">Orders</h1><p className="text-sm text-muted">{branchStaff ? `${user.branch?.name || 'Your branch'} · ` : ''}Refreshes every 20 seconds.</p></div><button className={buttonClass} onClick={refresh} disabled={busy}>Refresh</button></div>
    <ErrorMessage error={error || list.error || summary.error || branches.error} />{notice && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">{['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'active', 'refundsNeeded'].map((key) => <button key={key} className={`${cardClass} text-left ${key === 'placed' && summary.data?.data?.placed > 0 ? '!border-brand !bg-brand-light' : ''}`} onClick={() => { setFilters((previous) => ({ ...previous, status: key === 'refundsNeeded' ? '' : key, paymentStatus: key === 'refundsNeeded' ? 'refund_failed' : '' })); setPage(1) }}><span className="text-xs text-muted">{key === 'active' ? 'Active' : key === 'refundsNeeded' ? 'Refunds needed' : statusLabels[key]}</span><p className="mt-2 text-2xl font-semibold">{summary.data?.data?.[key] ?? '—'}</p></button>)}</div>
    <div className="flex flex-wrap gap-2">{[['active', 'Active'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['past', 'History'], ['', 'All Orders']].map(([value, label]) => <button key={value} className={filters.status === value ? primaryClass : buttonClass} onClick={() => { change('status', value); change('paymentStatus', '') }}>{label}</button>)}</div>
    <div className={`${cardClass} grid gap-3 sm:grid-cols-2 xl:grid-cols-4`}>
      <Field label="Search orders" value={filters.q} placeholder="Order number, name or phone" onChange={(event) => change('q', event.target.value)} />
      <Field label="Status"><select className={buttonClass} value={filters.status} onChange={(event) => change('status', event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="past">History</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      {!branchStaff && can(user, 'branches:view') && <Field label="Branch"><select className={buttonClass} value={filters.branchId} onChange={(event) => change('branchId', event.target.value)}><option value="">All branches</option>{branches.data?.data?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></Field>}
      <Field label="Fulfilment"><select className={buttonClass} value={filters.fulfilment} onChange={(event) => change('fulfilment', event.target.value)}><option value="">Delivery and pickup</option><option value="delivery">Delivery</option><option value="pickup">Pickup</option></select></Field>
      <Field label="Payment method"><select className={buttonClass} value={filters.paymentMethod} onChange={(event) => change('paymentMethod', event.target.value)}><option value="">All methods</option><option value="cod">Cash on delivery</option><option value="card">Card</option></select></Field>
      <Field label="Payment status"><select className={buttonClass} value={filters.paymentStatus} onChange={(event) => change('paymentStatus', event.target.value)}><option value="">All payment statuses</option>{['unpaid', 'paid', 'refunded', 'refund_failed'].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></Field>
      <Field label="From (Karachi date)" type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => change('from', event.target.value)} />
      <Field label="To (Karachi date)" type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => change('to', event.target.value)} />
      <Field label="Order"><select className={buttonClass} value={filters.sort} onChange={(event) => change('sort', event.target.value)}><option value="oldest">Oldest first</option><option value="newest">Newest first</option></select></Field>
    </div>
    {list.loading && <p role="status" className="text-sm text-muted">Updating orders…</p>}
    {!list.loading && !list.error && !list.data?.data?.length && <p className={cardClass}>No orders match these filters.</p>}
    <div className="flex flex-col gap-3">{list.data?.data?.map((order) => <article key={order.id} className={`${cardClass} flex flex-wrap items-center justify-between gap-4`}><button className="flex min-w-0 flex-col gap-1 text-left" onClick={() => setSelectedId(order.id)}><span className="text-lg font-semibold text-brand">#{order.number}</span><span className="text-sm font-medium">{order.customer?.name} · {order.customer?.phone}</span><span className="text-xs text-muted">{order.branch?.name} · {order.fulfilment} {order.area && `· ${order.area}`} · {order.itemCount} items</span><span className="text-xs text-muted">{dateTime(order.placedAt)}</span></button><div className="flex flex-col gap-2"><div className="flex flex-wrap items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${order.status === 'placed' ? 'bg-brand-light text-brand' : 'bg-gray-100'}`}>{statusLabels[order.status]}</span><span className="font-semibold">{money(order.total, order.currencySymbol)}</span><span className={`text-xs ${order.paymentStatus === 'refund_failed' ? 'font-semibold text-red-700' : 'text-muted'}`}>{order.paymentMethod} · {order.paymentStatus?.replaceAll('_', ' ')}</span></div>{renderActions(order)}<button className={`${buttonClass} self-end`} onClick={() => setSelectedId(order.id)}>View details</button></div></article>)}</div>
    <Pagination pagination={list.data?.pagination} page={page} onChange={setPage} disabled={list.loading} />
    {selectedId && <OrderDetailsDrawer id={selectedId} revision={revision} onClose={() => setSelectedId(null)} renderActions={renderActions} />}
    {action && <OrderStatusDialog action={action} onClose={() => setAction(null)} onSubmit={(extra) => transition(action.order, action.status, extra)} />}
  </div>
}
