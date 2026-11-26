import { tenant, can } from '../../lib/tenant'
import { useRemote } from '../../lib/useRemote'
import { useTenant } from '../../lib/TenantContext'
import { buttonClass, cardClass } from '../shared/ApiUI'
import { WorkspaceHeader, RemoteState } from '../shared/WorkspaceUI'
import { planDate, planPrice } from './setupHelpers'

export function PlanView() {
  const { user } = useTenant()
  const allowed = can(user, 'plan:view') && user.role === 'tenant_owner'
  const remote = useRemote(() => allowed ? tenant.get('plan') : Promise.resolve(null), [allowed])
  const data = remote.data?.data
  if (!allowed) return null
  const branches = data?.usage?.branches
  return <div className="workspace-page"><WorkspaceHeader title="Your plan" description="Your subscription, renewal dates and bakery usage." actions={<button className={buttonClass} disabled={remote.loading} onClick={remote.refresh}>Refresh plan</button>} />
    <RemoteState remote={remote} label="plan details">
      {data && <>
        {data.paymentProblem && <p className="workspace-warning" role="status">A payment failed; we are retrying. Please contact Bake My App if this continues.</p>}
        {data.cancelAtPeriodEnd && <p className="workspace-warning">Your subscription ends on {planDate(data.currentPeriodEnd)}.</p>}
        <div className="workspace-grid"><section className={`${cardClass} workspace-stack`}><div className="workspace-card-heading"><h2>{data.plan?.name || 'Your subscription'}</h2><span className="workspace-badge capitalize">{data.status?.replaceAll('_', ' ') || 'Not available'}</span></div><p className="workspace-hint">{data.plan?.description || 'Your current bakery plan.'}</p><p className="text-3xl font-semibold">{planPrice(data.price)}{data.price && <span className="text-sm font-normal text-muted"> / {data.price.interval || data.billingInterval || 'month'}</span>}</p>{data.plan?.features?.length > 0 && <ul className="workspace-stack text-sm">{data.plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>}<p className="workspace-hint">Contact Bake My App to change your plan or billing card.</p></section>
          <section className={`${cardClass} workspace-stack`}><h2>Subscription dates</h2><dl className="module-grid">{[[data.cancelAtPeriodEnd ? 'Ends on' : 'Next renewal', planDate(data.currentPeriodEnd)], ...(data.status === 'trial' || data.trialEndsAt ? [['Trial ends', planDate(data.trialEndsAt)]] : []), ['Billing interval', data.billingInterval || data.price?.interval || 'Custom']].map(([label, value]) => <div key={label} className="workspace-stat"><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section></div>
        <section className={`${cardClass} workspace-stack`}><h2>Plan usage</h2><div className="workspace-grid"><div className="workspace-stack"><div className="workspace-row"><strong className="text-sm">Active branches</strong><span className="workspace-hint">{branches?.used ?? 0} / {branches?.limit == null ? 'Unlimited' : branches.limit}</span></div>{branches?.limit != null && <div className="workspace-progress" role="progressbar" aria-label="Plan branch usage" aria-valuemin={0} aria-valuemax={branches.limit} aria-valuenow={Math.min(branches.used, branches.limit)} aria-valuetext={`${branches.used} of ${branches.limit} active branches`}><span style={{ width: `${Math.min(100, branches.limit ? branches.used / branches.limit * 100 : 100)}%` }} /></div>}<p className="workspace-hint">{branches?.limit == null ? 'Your plan has no branch limit.' : 'Only active branches count toward this limit.'}</p></div><div className="workspace-stat"><dt>Active team members</dt><dd>{data.usage?.team?.used ?? 0}</dd></div></div></section>
      </>}
    </RemoteState>
  </div>
}
