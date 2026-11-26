import { Store03Icon } from '@hugeicons/core-free-icons'
import { PageOptions, RefreshButton } from '../shared/PageOptions'
import { Skeleton } from '../shared/Skeleton'
import { useState } from 'react'
import { can, money, tenant } from '../../lib/tenant'
import { useTenant } from '../../lib/TenantContext'
import { useRemote } from '../../lib/useRemote'
import { ErrorMessage } from '../shared/ApiUI'
import { CatalogSearch, DesignIcon } from '../shared/CatalogUI'
import { BranchForm, BranchHours } from './BranchForm'
import { loadOrderMetrics, rangeDates } from '../orders/orderMetrics'
import { summarizeBranchOrders } from './branchMetrics'
import './branches.css'

function BranchMetrics({ id, canViewOrders, stats, symbol, loading }) {
  const summary = useRemote(() => canViewOrders ? tenant.list('orders/summary', { branchId: id }) : Promise.resolve(null), [id, canViewOrders], { poll: canViewOrders ? 20000 : 0 })
  const branch = stats?.branches[id]
  const resolved = (branch?.completed || 0) + (branch?.cancelled || 0)
  const performance = resolved ? Math.round(branch.completed / resolved * 100) : null
  return <div><div className="branch-metrics">
    <div><p>Sales</p><strong title="Collected revenue from today's orders">{loading && !stats ? <Skeleton variant="metric" label="Loading branch sales" /> : stats ? money(branch?.revenue || 0, stats.symbol || symbol) : '—'}</strong></div>
    <div><p>Active Orders</p><strong>{summary.loading && !summary.data && canViewOrders ? <Skeleton variant="metric" label="Loading active orders" /> : summary.data?.data?.active ?? '—'}</strong></div>
    <div className={performance != null && performance < 80 ? 'branch-performance-warning' : ''}><p>Performance</p><strong title="Completed orders as a percentage of completed and cancelled orders today">{loading && !stats ? <Skeleton variant="metric" label="Loading branch performance" /> : performance == null ? '—' : `${performance}%`}{performance != null && performance < 80 && <DesignIcon file="a581c" folder="branches" />}</strong></div>
  </div><ErrorMessage error={summary.error} /></div>
}

export function BranchesView({ onNavigateToOrders }) {
  const { user, branding } = useTenant()
  const editable = can(user, 'branches:edit')
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const [editor, setEditor] = useState(null)
  const [hours, setHours] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const list = useRemote(() => tenant.list('branches', { status: 'all' }), [])
  const canViewOrders = can(user, 'orders:view')
  const metrics = useRemote(() => canViewOrders ? loadOrderMetrics(rangeDates('Today'), summarizeBranchOrders) : Promise.resolve(null), [canViewOrders], { poll: canViewOrders ? 20000 : 0 })
  const plan = useRemote(() => can(user, 'plan:view') ? tenant.get('plan') : Promise.resolve(null), [user.id])
  const usage = plan.data?.data?.usage?.branches
  const branches = list.data?.data || []
  const counts = { all: branches.length, active: branches.filter((branch) => branch.isActive).length, inactive: branches.filter((branch) => !branch.isActive).length }
  const rows = branches.filter((branch) => (status === 'all' || branch.isActive === (status === 'active')) && [branch.name, branch.addressLine1, branch.addressLine2, branch.area, branch.city].filter(Boolean).join(' ').toLowerCase().includes(q.trim().toLowerCase()))
  const refresh = async () => { await Promise.all([list.refresh(), plan.refresh(), metrics.refresh()]) }
  const edit = async (branch) => {
    setBusy(true); setError(null)
    try { setEditor((await tenant.get(`branches/${branch.id}`)).data) } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return <div className="catalog-page branches-page">
    <header className="catalog-header"><div><h1>Branches</h1><p>Manage your bakery locations and employee access.</p></div>{editable && <button className="catalog-button catalog-primary" onClick={() => setEditor({})} disabled={usage?.limit != null && usage.used >= usage.limit}><DesignIcon file="8a223" />Add Branch</button>}</header>
    <div className="branch-stats">
      <section><p>Total Branches</p><strong>{list.loading && !list.data ? <Skeleton variant="metric" label="Loading branch count" /> : list.data ? counts.all : '—'}</strong></section>
      <section><p>Active</p><strong>{list.loading && !list.data ? <Skeleton variant="metric" label="Loading branch count" /> : list.data ? counts.active : '—'}</strong></section>
      <section><p>Avg. Revenue / Branch</p><strong title="Today's collected revenue divided by total branches">{metrics.loading && !metrics.data && canViewOrders ? <Skeleton variant="metric" label="Loading branch revenue" /> : metrics.data && list.data ? `${money(branches.length ? Math.round(metrics.data.revenue / branches.length) : 0, metrics.data.symbol || branding?.currencySymbol)}/d` : '—'}</strong></section>
      <section><p>Most Earning Branch</p><strong className="branch-top-name" title="Branch with the most collected revenue today">{metrics.loading && !metrics.data && canViewOrders ? <Skeleton variant="metric" label="Loading highest earning branch" /> : metrics.data?.topBranch || '—'}</strong></section>
    </div>
    {usage?.limit != null && usage.used >= usage.limit && <p className="branch-plan-notice">Your plan allows {usage.limit} branches. Contact us to add more.</p>}
    <ErrorMessage error={error || list.error || plan.error || metrics.error} />
    <section className="branches-content" aria-label="Bakery branches">
      <div className="branches-toolbar"><div className="catalog-tabs" role="tablist" aria-label="Branch status">{['all', 'active', 'inactive'].map((tab) => <button key={tab} role="tab" aria-selected={status === tab} onClick={() => setStatus(tab)}>{tab === 'all' ? 'All' : tab === 'active' ? 'Active' : 'Inactive'}<span>{list.data ? counts[tab] : '—'}</span></button>)}</div><CatalogSearch label="Search branches" placeholder="Search branch..." value={q} onChange={setQ} /></div>
      {list.loading && !list.data && <Skeleton variant="cards" label="Loading branches" rows={4} />}
      {!list.loading && !list.error && !rows.length && <div className="branch-empty"><h2>{q || status !== 'all' ? 'No branches found' : 'Your branches will appear here'}</h2><p>{q || status !== 'all' ? 'Try another search or status.' : 'Add your first bakery location to get started.'}</p></div>}
      <div className="branches-grid">{rows.map((branch) => <article key={branch.id} className="branch-card">
        <header><div><h2>{branch.name}</h2><p>{[branch.addressLine1, branch.addressLine2, branch.area, branch.city].filter(Boolean).join(', ')}</p></div><span className={`branch-status branch-status-${branch.status}`}>{!branch.isActive ? 'Inactive' : branch.status === 'paused' ? 'Paused' : branch.status === 'closed' ? 'Closed' : 'Active'}</span></header>
        <BranchMetrics loading={metrics.loading && canViewOrders} id={branch.id} canViewOrders={canViewOrders} stats={metrics.data} symbol={branding?.currencySymbol} />
        <div className="branch-card-actions">{can(user, 'orders:view') && <button className="catalog-button" onClick={() => onNavigateToOrders(branch.id)}>View Orders</button>}{editable && <button className="catalog-button catalog-primary" disabled={busy} onClick={() => edit(branch)}>Manage Branch</button>}</div>
      </article>)}</div>
    </section>
    <PageOptions title={usage ? 'Branch capacity' : 'Branch list'} description={usage ? 'Your plan counts active branches. Inactive locations keep their order history.' : 'Keep branch details and performance up to date.'} icon={Store03Icon} collapsible={false} actions={<RefreshButton label="Refresh branches" refreshing={list.loading || plan.loading} disabled={busy} onClick={refresh} />}>
      {usage && <div className="page-options-capacity">
        <div className="page-options-row"><strong>{usage.limit == null ? usage.used + ' active branches' : usage.used + ' of ' + usage.limit + ' active branches used'}</strong><span className="page-options-hint">{usage.limit == null ? 'Unlimited branches on your plan' : Math.max(0, usage.limit - usage.used) + ' remaining'}</span></div>
        {usage.limit != null && <div className="page-options-progress" role="progressbar" aria-label="Active branch capacity" aria-valuemin={0} aria-valuemax={usage.limit} aria-valuenow={usage.used} aria-valuetext={usage.used + ' of ' + usage.limit + ' active branches used'}><span style={{ width: Math.min(100, usage.limit ? usage.used / usage.limit * 100 : 100) + '%' }} /></div>}
        {usage.limit != null && usage.used >= usage.limit && <p className="page-options-hint">Your plan is full. Contact us to add more active branches.</p>}
      </div>}
    </PageOptions>
    {editor && <BranchForm key={editor.id || 'new'} branch={editor} onClose={() => setEditor(null)} onOpenHours={(branch) => { setEditor(null); setHours(branch) }} onSaved={async (branch, created) => { setEditor(null); if (created) setHours(branch); await refresh() }} />}
    {hours && <BranchHours key={hours.id} branch={hours} editable={editable} onClose={() => setHours(null)} onSaved={list.refresh} />}
  </div>
}
