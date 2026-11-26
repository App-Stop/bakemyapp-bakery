import { SetupChecklist } from '../setup/SetupView'
import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight02Icon, MenuRestaurantIcon, Store04Icon, PaintBoardIcon, DiscountIcon } from '@hugeicons/core-free-icons'
import { useTenant } from '../../lib/TenantContext'
import { tenant, can, money, dateTime } from '../../lib/tenant'
import { useRemote } from '../../lib/useRemote'
import { ErrorMessage, buttonClass } from '../shared/ApiUI'
import { Skeleton } from '../shared/Skeleton'
import { AuditEntry } from './AuditEntry'
import { reportDates, reportRanges as TIME_RANGES, comparison, breakdown } from '../analytics/reporting'

export function OverviewView({ onNavigate: setActiveNav, setupRemote }) {
  const { user, branding } = useTenant()
  const [activeTimeRange, setActiveTimeRange] = useState('7d')
  const [table, setTable] = useState('products')
  const store = useRemote(() => tenant.get('store'), [])
  const timezone = store.data?.data?.timezone
  const overview = useRemote(() => tenant.get('overview'), [], { poll: 30000 })
  const dates = reportDates(activeTimeRange, timezone || 'Asia/Karachi')
  const analytics = useRemote(() => timezone ? tenant.list('analytics', dates).then((result) => ({ ...result, requestKey: JSON.stringify(dates) })) : Promise.resolve(null), [timezone, dates.from, dates.to, dates.groupBy])
  const auditAllowed = can(user, 'audit:view')
  const audit = useRemote(() => auditAllowed ? tenant.list('audit-logs', { page: 1, limit: 4 }) : Promise.resolve(null), [auditAllowed], { poll: auditAllowed ? 30000 : 0 })
  const data = overview.data?.data
  const report = analytics.data?.requestKey === JSON.stringify(dates) ? analytics.data.data : null
  const totals = activeTimeRange === 'Today' ? data?.today : report?.totals
  const symbol = store.data?.data?.currencySymbol || branding?.currencySymbol
  const top = report?.topProducts
  const products = (top || []).map((row) => ({ name: row.name || row.productName, sold: row.quantity ?? row.units ?? 0, sales: money(row.sales, symbol), price: '\u2014', status: '\u2014' }))
  const branchMix = breakdown(report?.byBranch)
  const fulfilment = breakdown(report?.byFulfilment, 'fulfilment')
  const events = audit.data?.data || []
  const error = overview.error || analytics.error || store.error
  const loading = overview.loading || analytics.loading || store.loading
  const metrics = [
    { label: 'Sales', value: totals ? money(totals.sales, symbol) : '\u2014', badge: totals ? comparison(totals.salesChange) : '\u2014', note: activeTimeRange === 'Today' ? 'vs yesterday' : 'vs previous period' },
    { label: 'Orders & Avg Ticket', value: totals?.orders ?? '\u2014', badge: totals ? comparison(totals.ordersChange) : '\u2014', note: totals ? money(totals.averageOrder, symbol) + ' average' : '' },
    { label: 'Active Orders', value: data?.activeOrders?.total ?? '\u2014', badge: data ? (data.activeOrders?.ready || 0) + ' ready' : '\u2014', note: 'Live kitchen queue' },
    { label: 'Customers', value: data?.customers?.total ?? '\u2014', badge: data ? (data.customers?.newToday || 0) + ' new today' : '\u2014', note: data ? (data.customers?.newThisWeek || 0) + ' new this week' : '' },
  ]
  return (
          <div className="mx-auto flex max-w-[1360px] flex-col gap-7 max-sm:gap-4">
            {/* Header Row */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h1 className="text-[28px] font-semibold tracking-tight text-ink">Welcome back, {user.name}</h1>
              <p className="text-sm text-muted">
                Here’s what is happening with your digital storefront today.
              </p>
            </div>

            {/* Time Filter Pills */}
            <div className="flex items-center gap-1 rounded-[10px] border border-[#dcdcdc] bg-[#e8e8e8] p-1 max-sm:w-full">
              {TIME_RANGES.map((range) => {
                const isSelected = activeTimeRange === range
                return (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setActiveTimeRange(range)}
                    className={`rounded-[6px] px-3 py-1.5 text-xs font-semibold transition-all max-sm:flex-1 max-sm:py-1.5 max-sm:text-[13px] ${
                      isSelected
                        ? 'bg-white text-ink shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]'
                        : 'text-body hover:text-ink'
                    }`}
                  >
                    {range}
                  </button>
                )
              })}
            </div>
          </div>

          {error && <div><ErrorMessage error={error} /><button className={buttonClass} onClick={() => { store.refresh(); overview.refresh(); analytics.refresh() }}>Retry overview</button></div>}
          {can(user, 'setup:view') && <SetupChecklist compact remote={setupRemote} onNavigate={setActiveNav} />}
          {/* Stats Row */}
          <div className="dash-stats grid grid-cols-2 gap-5 max-sm:gap-3 xl:grid-cols-4">
            {metrics.map((metric, index) => <div key={metric.label} className="flex flex-col gap-3 rounded-[16px] bg-white p-5 shadow-[0px_4px_10px_rgba(0,0,0,0.02)] max-sm:min-h-[144px] max-sm:p-4">
              <p className="text-sm font-medium text-muted">{metric.label}</p><div className="flex flex-col">
                <p className="text-[28px] font-semibold text-ink leading-tight">{(index < 2 ? !totals && loading : !data && overview.loading) ? <Skeleton variant="metric" label={'Loading ' + metric.label} /> : metric.value}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5"><span className={String(metric.badge).startsWith('-') ? 'rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700' : 'rounded bg-[#effce8] px-1.5 py-0.5 text-xs font-medium text-[#39ab00]'}>{metric.badge}</span><span className="text-[11px] text-muted">{metric.note}</span></div>
              </div>
            </div>)}
          </div>

          {/* Grid Row 1: Bestsellers + Category Share */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_400px] max-sm:contents">
            {/* Left: Product Velocity & Bestsellers Table */}
            <div className="flex flex-col gap-5 rounded-[20px] bg-white p-6 shadow-[0px_4px_10px_rgba(0,0,0,0.02)] max-sm:order-2 max-sm:p-4">
              <div className="flex items-center justify-between max-sm:gap-4">
                <h2 className="text-lg font-semibold text-ink max-sm:text-base"><select aria-label="Overview table" className="max-w-full bg-transparent font-semibold" value={table} onChange={(event) => setTable(event.target.value)}><option value="products">Product Velocity & Bestsellers</option><option value="orders">Recent Orders</option></select></h2>
                <button
                  type="button"
                  onClick={() => setActiveNav('menu')}
                  className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-brand hover:opacity-85 max-sm:gap-2.5 max-sm:text-sm"
                >
                  <span>View Menu</span>
                  <HugeiconsIcon icon={ArrowRight02Icon} size={16} color="currentColor" />
                </button>
              </div>

              {table === 'products' ? <>
                {!top && loading ? <Skeleton variant="list" label="Loading bestsellers" rows={5} /> : !products.length ? <p className="text-sm text-muted">No sales in this period.</p> : <>
                  <div className="flex flex-col sm:hidden">{products.map((p, i) => <div key={i} className="flex items-center gap-3 border-b border-[#eee] py-2.5 last:border-0"><span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-[#e8e8e8] text-brand"><HugeiconsIcon icon={MenuRestaurantIcon} size={24} /></span><div className="flex min-w-0 flex-1 flex-col gap-0.5"><p className="truncate text-[13px] font-medium text-ink">{p.name}</p><p className="text-xs text-[#6a6a6a]">{p.sold} units sold</p></div><p className="text-[13px] font-semibold text-ink">{p.sales}</p></div>)}</div>
                  <div className="w-full overflow-x-auto max-sm:hidden"><div className="min-w-[500px]"><div className="flex items-center gap-2.5 pb-2 border-b border-[#f0ece9] text-xs font-semibold text-[#848484]"><span className="flex-1">Product</span><span className="w-20 text-left">Price</span><span className="w-20 text-left">Units Sold</span><span className="w-20 text-left">Sales</span><span className="w-[70px] text-center">Status</span></div><div className="flex flex-col divide-y divide-[#f5f5f5]">{products.map((p, i) => <div key={i} className="flex items-center gap-2.5 py-2.5 text-[13px] text-ink"><div className="flex flex-1 items-center gap-2.5 min-w-0 pr-2"><span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-[#e8e8e8] text-brand"><HugeiconsIcon icon={MenuRestaurantIcon} size={24} /></span><span className="truncate font-medium" title={p.name}>{p.name}</span></div><span className="w-20 font-medium" title="Current price is not part of this sales report">{p.price}</span><span className="w-20 font-medium">{p.sold}</span><span className="w-20 font-medium">{p.sales}</span><span className="w-[70px] text-center" title="Availability is managed in Menu">{p.status}</span></div>)}</div></div></div>
                </>}
              </> : overview.loading && !data ? <Skeleton variant="list" label="Loading recent orders" rows={5} /> : !data?.recentOrders?.length ? <p className="text-sm text-muted">No recent orders.</p> : <div className="flex flex-col divide-y divide-[#f5f5f5]">{data.recentOrders.map((order) => <button key={order.id} onClick={() => setActiveNav('orders')} className="flex items-center justify-between gap-3 py-3 text-left text-sm"><span className="min-w-0"><strong>#{order.number} {order.customerName}</strong><small className="block text-muted">{order.branchName} | {order.status} | {dateTime(order.placedAt)}</small></span><strong>{money(order.total, symbol)}</strong></button>)}</div>}
            </div>

            {/* Right: Category Share & Fulfillment Mix */}
            <div className="flex flex-col justify-between gap-6 rounded-[20px] bg-white p-6 shadow-[0px_4px_10px_rgba(0,0,0,0.02)] max-sm:order-3 max-sm:gap-4 max-sm:p-4">
              <h2 className="text-lg font-semibold text-ink max-sm:text-base">Branch Sales & Fulfillment Mix</h2>

              <Mix rows={branchMix} loading={analytics.loading || store.loading} />
              <div className="h-px w-full bg-[#f0ece9]" />
              <Mix rows={fulfilment} loading={analytics.loading || store.loading} />
              <div className="workspace-actions text-xs text-muted"><button className="text-brand underline underline-offset-2" onClick={() => setActiveNav('support', { tab: 'tickets' })}>{data ? data.support?.openRequests || 0 : '\u2014'} open support requests</button><span aria-hidden="true">|</span><button className="text-brand underline underline-offset-2" onClick={() => setActiveNav('support', { tab: 'chats' })}>{data ? data.support?.chatsNeedingReply || 0 : '\u2014'} chats awaiting reply</button></div>
            </div>
          </div>

          {/* Grid Row 2: Operational Audit Timeline + Quick Access */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_400px] max-sm:contents">
            {/* Left: Operational Audit Timeline */}
            {auditAllowed && <div className="flex flex-col gap-5 rounded-[20px] bg-white p-6 shadow-[0px_4px_10px_rgba(0,0,0,0.02)] max-sm:order-4 max-sm:p-4">
              <h2 className="text-lg font-semibold text-ink max-sm:text-base">Operational Audit Timeline</h2>

              <ErrorMessage error={audit.error} />
              {audit.error && <button className={buttonClass} onClick={audit.refresh}>Retry activity</button>}
              {!auditAllowed ? <p className="text-sm text-muted">The activity log is available to bakery owners.</p> : audit.loading && !audit.data ? <Skeleton variant="list" label="Loading activity" rows={4} /> : !events.length ? <p className="text-sm text-muted">No activity yet.</p> : <div className="flex flex-col divide-y divide-[#f0ece9]">{events.map((event, index) => <AuditEntry key={event.id || index} event={event} symbol={symbol} />)}</div>}
            </div>}

            {/* Right: Quick Access */}
            <div className="flex flex-col self-start justify-between gap-5 rounded-[20px] bg-white p-6 shadow-[0px_4px_10px_rgba(0,0,0,0.02)] max-sm:order-1 max-sm:gap-2.5 max-sm:p-4">
              <h2 className="text-lg font-semibold text-ink max-sm:text-base">Quick Access</h2>

              <div className="grid grid-cols-2 gap-3 max-sm:gap-2.5">
                {/* Tile 1: Menu & Stock */}
                <button
                  type="button"
                  onClick={() => setActiveNav('menu')}
                  className="flex flex-col items-center gap-3.5 rounded-xl border border-[#dcdcdc] p-4 text-center shadow-[0px_4px_20px_0px_rgba(0,0,0,0.02)] transition-all hover:border-brand hover:shadow-md cursor-pointer group"
                >
                  <div className="flex size-10 items-center justify-center rounded bg-brand-light text-brand group-hover:scale-105 transition-transform">
                    <HugeiconsIcon icon={MenuRestaurantIcon} size={20} color="var(--brand)" />
                  </div>
                  <span className="text-sm font-medium leading-snug text-ink">
                    Menu &amp; Stock Management
                  </span>
                </button>

                {/* Tile 2: Branch Management */}
                <button
                  type="button"
                  onClick={() => setActiveNav('branches')}
                  className="flex flex-col items-center gap-3.5 rounded-xl border border-[#dcdcdc] p-4 text-center shadow-[0px_4px_20px_0px_rgba(0,0,0,0.02)] transition-all hover:border-[#e04f6e] hover:shadow-md cursor-pointer group"
                >
                  <div className="flex size-10 items-center justify-center rounded bg-[#fcecf0] text-[#e04f6e] group-hover:scale-105 transition-transform">
                    <HugeiconsIcon icon={Store04Icon} size={20} color="currentColor" />
                  </div>
                  <span className="text-sm font-medium leading-snug text-ink">
                    Branch Management
                  </span>
                </button>

                {/* Tile 3: Customize your Cafe */}
                <button
                  type="button"
                  onClick={() => setActiveNav('settings')}
                  title="Click to customize your cafe brand colors & settings"
                  className="flex flex-col items-center gap-3.5 rounded-xl border border-[#dcdcdc] p-4 text-center shadow-[0px_4px_20px_0px_rgba(0,0,0,0.02)] transition-all hover:border-[#2b9fd9] hover:shadow-md cursor-pointer group"
                >
                  <div className="flex size-10 items-center justify-center rounded bg-[#e6f6ff] text-[#2b9fd9] group-hover:scale-105 transition-transform">
                    <HugeiconsIcon icon={PaintBoardIcon} size={20} color="currentColor" />
                  </div>
                  <span className="text-sm font-medium leading-snug text-ink">
                    Customize your Cafe
                  </span>
                </button>

                {/* Tile 4: Create Promotion / Offer */}
                <button
                  type="button"
                  onClick={() => setActiveNav('pricing')}
                  className="flex flex-col items-center gap-3.5 rounded-xl border border-[#dcdcdc] p-4 text-center shadow-[0px_4px_20px_0px_rgba(0,0,0,0.02)] transition-all hover:border-[#39ab00] hover:shadow-md cursor-pointer group"
                >
                  <div className="flex size-10 items-center justify-center rounded bg-[#effce8] text-[#39ab00] group-hover:scale-105 transition-transform">
                    <HugeiconsIcon icon={DiscountIcon} size={20} color="currentColor" />
                  </div>
                  <span className="text-sm font-medium leading-snug text-ink">
                    Manage pricing & offers
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
  )
}

function Mix({ rows, loading }) {
  if (loading && !rows.length) return <Skeleton variant="list" label="Loading sales breakdown" rows={2} />
  return <div className="flex flex-col gap-4"><div className="flex h-5 w-full gap-1 overflow-hidden rounded bg-[#f5f5f5]">{rows.map((row, i) => <div key={i} className="h-full rounded" style={{ width: row.percent + '%', background: row.color }} title={row.name + ': ' + row.percent + '%'} />)}</div><div className="flex flex-col gap-2.5 text-[13px]">{rows.length ? rows.map((row, i) => <div key={i} className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="size-3 rounded-[2px]" style={{ background: row.color }} /><span className="text-muted capitalize">{row.name}</span></div><span className="font-semibold text-ink">{row.percent}%</span></div>) : <p className="text-muted">No sales in this period.</p>}</div></div>
}
