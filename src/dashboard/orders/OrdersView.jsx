import { Skeleton, SkeletonRows } from '../shared/Skeleton'
import { useCallback, useState } from 'react'
import { can, dateTime, money, tenant } from '../../lib/tenant'
import { useTenant } from '../../lib/TenantContext'
import { useRemote } from '../../lib/useRemote'
import { buttonClass, ErrorMessage, Field } from '../shared/ApiUI'
import { CatalogPagination, CatalogSearch, DesignIcon } from '../shared/CatalogUI'
import { OrderDetailsDrawer } from './OrderDetailsDrawer'
import { OrderStatusDialog } from './OrderStatusDialog'
import { actionLabel, statusLabels } from './orderHelpers'
import { loadOrderMetrics, rangeDates, timeRanges } from './orderMetrics'

const tabs = [['active', 'Active'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['', 'All Orders']]

export function OrdersView({ initialBranchId = '' }) {
  const { user, branding } = useTenant()
  const [tab, setTab] = useState('active')
  const [range, setRange] = useState('7d')
  const [filters, setFilters] = useState({ status: '', branchId: initialBranchId, q: '', fulfilment: '', paymentMethod: '', paymentStatus: '', ...rangeDates('7d'), sort: 'oldest' })
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState(null)
  const closeDetails = useCallback(() => setSelectedId(null), [])
  const [action, setAction] = useState(null)
  const [revision, setRevision] = useState(0)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const branchStaff = user.role === 'branch_staff'
  const editable = can(user, 'orders:manage')
  const list = useRemote(() => tenant.list('orders', { ...filters, status: filters.status || tab, ...(branchStaff ? { branchId: undefined } : {}), page, limit: 8 }), [JSON.stringify(filters), tab, page], { poll: 20000 })
  const summary = useRemote(() => tenant.list('orders/summary', branchStaff ? {} : { branchId: filters.branchId }), [filters.branchId], { poll: 20000 })
  const metrics = useRemote(() => loadOrderMetrics({ from: filters.from, to: filters.to, ...(!branchStaff ? { branchId: filters.branchId } : {}) }), [filters.from, filters.to, filters.branchId], { poll: 20000 })
  const branches = useRemote(() => can(user, 'branches:view') ? tenant.list('branches', { status: 'all' }) : Promise.resolve(null), [user.id])
  const change = (name, value) => { setFilters((previous) => ({ ...previous, [name]: value })); setPage(1) }
  const changeTab = (value) => { setTab(value); setFilters((previous) => ({ ...previous, status: '', paymentStatus: '' })); setPage(1) }
  const refresh = async () => { await Promise.all([list.refresh(), summary.refresh(), metrics.refresh()]); setRevision((value) => value + 1) }
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
  const renderActions = (order, { compact = false } = {}) => editable && <div className={`order-actions ${compact ? 'order-actions-compact' : ''}`}>{order.nextStatuses?.filter((status) => !compact || status !== 'cancelled').map((status) => <button key={status} className={`order-action action-${status}`} title={actionLabel(status, order)} aria-label={actionLabel(status, order)} disabled={busy || list.loading} onClick={() => chooseAction(order, status)}>{compact && status === 'completed' ? order.fulfilment === 'pickup' ? 'Received' : 'Delivered' : actionLabel(status, order)}</button>)}</div>
  const completed = tab === 'completed' && !filters.status
  const rows = list.data?.data || []
  const stats = metrics.data
  const refundCount = summary.data?.data?.refundsNeeded || 0
  return <div className="catalog-page orders-page">
    <header className="catalog-header"><div><h1>Orders</h1><p>{branchStaff ? `${user.branch?.name || 'Your branch'} · ` : ''}Live ticket stream, processing and delivery timeline manager.</p></div><div className="order-time-ranges" aria-label="Order date range">{timeRanges.map((value) => <button key={value} aria-pressed={range === value} onClick={() => { setRange(value); setFilters((previous) => ({ ...previous, ...rangeDates(value) })); setPage(1) }}>{value}</button>)}</div></header>
    <ErrorMessage error={error || list.error || summary.error || metrics.error || branches.error} />
    {notice && <p role="status" className="catalog-notice">{notice}</p>}
    <div className="order-stats dash-stats">
      <section title="Collected revenue for the selected dates"><p>Total Revenue</p><strong>{metrics.loading && !metrics.data ? <Skeleton variant="metric" label="Loading revenue" /> : stats ? money(stats.revenue, stats.symbol || branding?.currencySymbol) : '—'}</strong></section>
      <section title="Average non-cancelled orders per branch with orders in the selected dates"><p>Order per Branch</p><strong>{metrics.loading && !metrics.data ? <Skeleton variant="metric" label="Loading orders per branch" /> : stats?.perBranch ?? '—'}</strong></section>
      <section><p>Most ordered branch</p><strong className="order-top-branch">{metrics.loading && !metrics.data ? <Skeleton variant="metric" label="Loading top branch" /> : stats?.topBranch || '—'}</strong></section>
    </div>
    <section className="orders-content" aria-label="Orders list">
      <div className="orders-toolbar">
        <div className="catalog-tabs" role="tablist" aria-label="Order status">{tabs.map(([value, label]) => <button key={value} role="tab" aria-label={label} aria-selected={tab === value} onClick={() => changeTab(value)}>{label}<span>{stats?.counts[value || 'all'] ?? '—'}</span></button>)}</div>
        <div className="orders-filters"><select aria-label="Filter orders by status" className="catalog-select" value={filters.status} onChange={(event) => change('status', event.target.value)}><option value="">Status</option>{Object.entries(statusLabels).filter(([value]) => !tab || (tab === 'active' ? !['completed', 'cancelled'].includes(value) : value === tab)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          {!branchStaff && can(user, 'branches:view') && <select aria-label="Filter orders by branch" className="catalog-select" value={filters.branchId} onChange={(event) => change('branchId', event.target.value)}><option value="">All Branches</option>{branches.data?.data?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>}
          <CatalogSearch label="Search orders" value={filters.q} placeholder="Search order #, customer..." onChange={(value) => change('q', value)} />
        </div>
      </div>
      <div className="orders-table-card" aria-busy={list.loading}>
        <div className="catalog-table-scroll"><table className={`orders-table ${completed ? 'orders-table-completed' : ''}`}><thead><tr>{['Order', 'Customer', 'Items', 'Type', ...(completed ? ['Total', 'Payment', 'Date & Time'] : ['Date & Time', 'Total', 'Payment', 'Status', ''])].map((label, i) => <th key={i} scope="col">{label || <span className="sr-only">Actions</span>}</th>)}</tr></thead><tbody>
          {rows.map((order) => <tr key={order.id} className={`${selectedId === order.id ? 'order-selected' : ''} ${order.status === 'placed' ? 'order-new' : ''}`} onClick={() => setSelectedId(order.id)}>
            <td><button className="order-number" aria-label={`View details for order #${order.number}`} onClick={() => setSelectedId(order.id)}>#{order.number}</button></td>
            <td className="order-customer" title={`${order.customer?.phone || ''} · ${order.branch?.name || ''}`}>{order.customer?.name}</td>
            <td className="order-items"><span>{order.items?.length ? order.items.map((item) => `${item.quantity}x ${item.productName}`).join(', ') : `${order.itemCount || 0} ${order.itemCount === 1 ? 'item' : 'items'}`}</span></td>
            <td><span className="order-type"><DesignIcon file={order.fulfilment === 'delivery' ? '53b0e' : 'cf619'} />{order.fulfilment === 'delivery' ? 'Delivery' : 'Pickup'}</span></td>
            {!completed && <td className="order-date">{dateTime(order.placedAt)}</td>}
            <td className="order-total">{money(order.total, order.currencySymbol)}</td>
            <td title={`${order.paymentMethod} · ${order.paymentStatus?.replaceAll('_', ' ')}`} className={order.paymentStatus === 'refund_failed' ? 'text-red-700' : ''}>{order.paymentMethod === 'cod' ? 'Cash' : 'Card'}{order.paymentStatus === 'refund_failed' && <small className="block">Refund failed</small>}</td>
            {completed ? <td className="order-date">{dateTime(order.placedAt)}</td> : <><td><span className={`order-status status-${order.status}`}>{statusLabels[order.status]}</span></td><td onClick={(event) => event.stopPropagation()}>{renderActions(order, { compact: true })}</td></>}
          </tr>)}
          {!rows.length && (list.loading ? <SkeletonRows columns={completed ? 7 : 9} rows={8} label="Loading orders" /> : <tr><td colSpan={completed ? 7 : 9} className="catalog-empty-message" role="status">{list.error ? 'Orders could not be loaded.' : 'No orders match these filters.'}</td></tr>)}
        </tbody></table></div>
        <CatalogPagination pagination={list.data?.pagination} page={page} count={rows.length} noun={tab ? `${tab} orders` : 'orders'} onChange={setPage} disabled={list.loading} />
      </div>
      <details className="catalog-tools"><summary>More filters & actions{refundCount > 0 && <span className="text-red-700"> · {refundCount} refunds needed</span>}</summary><div className="catalog-tools-content">
        <Field label="Fulfilment"><select className={buttonClass} value={filters.fulfilment} onChange={(event) => change('fulfilment', event.target.value)}><option value="">Delivery and pickup</option><option value="delivery">Delivery</option><option value="pickup">Pickup</option></select></Field>
        <Field label="Payment method"><select className={buttonClass} value={filters.paymentMethod} onChange={(event) => change('paymentMethod', event.target.value)}><option value="">All methods</option><option value="cod">Cash on delivery</option><option value="card">Card</option></select></Field>
        <Field label="Payment status"><select className={buttonClass} value={filters.paymentStatus} onChange={(event) => change('paymentStatus', event.target.value)}><option value="">All payment statuses</option>{['unpaid', 'pending', 'paid', 'refunded', 'refund_failed'].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></Field>
        <Field label="From (Karachi date)" type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => { setRange(''); change('from', event.target.value) }} />
        <Field label="To (Karachi date)" type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => { setRange(''); change('to', event.target.value) }} />
        <Field label="Order"><select className={buttonClass} value={filters.sort} onChange={(event) => change('sort', event.target.value)}><option value="oldest">Oldest first</option><option value="newest">Newest first</option></select></Field>
        <button className={buttonClass} onClick={refresh} disabled={busy}>Refresh</button><button className={buttonClass} onClick={() => { changeTab(''); change('paymentStatus', 'refund_failed') }}>Refunds needed ({refundCount})</button>
      </div></details>
    </section>
    {selectedId && <OrderDetailsDrawer id={selectedId} revision={revision} onClose={closeDetails} renderActions={renderActions} />}
    {action && <OrderStatusDialog action={action} onClose={() => setAction(null)} onSubmit={(extra) => transition(action.order, action.status, extra)} />}
  </div>
}
