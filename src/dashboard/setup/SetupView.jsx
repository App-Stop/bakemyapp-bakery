import { can } from '../../lib/tenant'
import { useTenant } from '../../lib/TenantContext'
import { buttonClass, cardClass, primaryClass } from '../shared/ApiUI'
import { WorkspaceHeader, RemoteState } from '../shared/WorkspaceUI'
import { setupDestination } from './setupHelpers'

export function SetupChecklist({ onNavigate, compact = false, remote }) {
  const { user } = useTenant()
  const setup = remote.data?.data
  const percent = Math.max(0, Math.min(100, setup?.progress?.percent || 0))
  return <section className={`${cardClass} workspace-stack`} aria-label="Bakery setup checklist">
    <div className="workspace-card-heading"><div><h2>{setup?.complete ? 'Setup complete' : 'Set up your bakery'}</h2><p className="workspace-hint">{setup?.complete ? 'Every required step is complete.' : 'Complete the required steps to get your bakery ready for customers.'}</p></div><button className={buttonClass} onClick={remote.refresh} disabled={remote.loading}>Refresh checklist</button></div>
    <RemoteState remote={remote} label="setup checklist">
      {setup && <>
        <div className="workspace-row"><span className="workspace-hint">{setup.progress?.done ?? 0} of {setup.progress?.total ?? 0} required steps complete</span><strong className="text-sm text-brand">{percent}%</strong></div>
        <div className="workspace-progress" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>
        {compact ? <div className="workspace-row"><p className="workspace-hint">Optional steps do not hold up your progress.</p><button className={primaryClass} onClick={() => onNavigate('setup')}>View setup checklist</button></div> : <ol>{(setup.items || []).filter((item) => item.available).map((item, index) => {
          const destination = setupDestination(item, user)
          const ownerStep = ['business', 'branding', 'payments'].includes(item.key) && user.role !== 'tenant_owner'
          return <li key={item.key || item.route} className="workspace-step"><span className="workspace-step-number" data-done={item.done}>{item.done ? '✓' : index + 1}</span><div><div className="workspace-actions"><h3>{item.title}</h3><span className={`workspace-badge ${item.done ? '' : 'workspace-badge-muted'}`}>{item.done ? 'Complete' : item.required ? 'Required' : 'Optional'}</span></div><p className="workspace-hint">{item.description}</p>{ownerStep && !item.done && <p className="workspace-hint">The bakery owner completes this step.</p>}</div><div className="workspace-actions">{destination ? <button className={buttonClass} onClick={() => onNavigate(destination)}>{item.done || ownerStep ? 'View details' : 'Continue'}</button> : <span className="workspace-hint">Ask your owner</span>}</div></li>
        })}</ol>}
      </>}
    </RemoteState>
  </section>
}

export function SetupView({ onNavigate, remote }) {
  const { user } = useTenant()
  if (!can(user, 'setup:view')) return null
  return <div className="workspace-page"><WorkspaceHeader title="Bakery setup" description="Keep track of the essentials for launching and running your bakery." /><SetupChecklist remote={remote} onNavigate={onNavigate} /></div>
}
