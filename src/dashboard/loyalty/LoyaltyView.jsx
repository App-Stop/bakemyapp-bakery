import { rowsOf } from '../../lib/records'
import { useState } from 'react'
import { tenant } from '../../lib/tenant'
import { useTenant } from '../../lib/TenantContext'
import { useRemote } from '../../lib/useRemote'
import { canManagePayments } from '../payments/paymentHelpers'
import { CatalogModal } from '../shared/CatalogUI'
import { ErrorMessage, Field, buttonClass, cardClass, primaryClass } from '../shared/ApiUI'
import { WorkspaceHeader, WorkspaceTabs, RemoteState, Textarea } from '../shared/WorkspaceUI'
import { SettingsToggle } from '../settings/SettingsToggle'
import { loyaltyForm, loyaltyPatch, rewardBody } from './loyaltyHelpers'

export function LoyaltyView() {
  const { user } = useTenant()
  const [tab, setTab] = useState('rules')
  if (!canManagePayments(user)) return null
  return <div className="workspace-page"><WorkspaceHeader title="Loyalty" description="Reward regular customers with wallet credit, points and rewards." /><WorkspaceTabs label="Loyalty sections" options={[["rules", "Wallet & points"], ["rewards", "Rewards"]]} value={tab} onChange={setTab} />{tab === 'rules' ? <LoyaltyRules /> : <Rewards />}</div>
}
function LoyaltyRules() {
  const { branding } = useTenant()
  const remote = useRemote(() => tenant.get('loyalty'), [])
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  return <section className={`${cardClass} workspace-stack`}><div className="workspace-card-heading"><div><h2>Wallet & points rules</h2><p className="workspace-hint">Both features stay off until you enable them.</p></div><button className={buttonClass} disabled={remote.loading || dirty} onClick={remote.refresh}>Refresh loyalty rules</button></div><p role="status" className={notice ? 'workspace-notice' : 'hidden'}>{notice}</p><RemoteState remote={remote} label="loyalty rules">{remote.data?.data && <RulesForm key={JSON.stringify(remote.data.data)} data={remote.data.data} symbol={branding?.currencySymbol || 'Rs'} onDirty={(value) => { setDirty(value); if (value) setNotice('') }} onSaved={async () => { setNotice('Loyalty rules saved.'); return remote.refresh() }} />}</RemoteState></section>
}
function RulesForm({ data, symbol, onDirty, onSaved }) {
  const [form, setForm] = useState(() => loyaltyForm(data))
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const update = (key, value) => { setForm((before) => ({ ...before, [key]: value })); onDirty(true); setNotice('') }
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError(null)
    try { const patch = loyaltyPatch(data, form); if (Object.keys(patch).length) { await tenant.patch('loyalty', patch); onDirty(false); setNotice('Loyalty rules saved.'); await onSaved() } else { onDirty(false); setNotice('No changes to save.') } } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return <form className="workspace-stack" onSubmit={save}><ErrorMessage error={error} />{notice && <p role="status" className="workspace-notice">{notice}</p>}<fieldset disabled={busy} className="workspace-stack"><div className="module-toggle"><div><strong>Customer wallet</strong><p className="workspace-hint">Let customers use wallet credit at checkout and receive goodwill credits.</p></div><SettingsToggle ariaLabel="Enable customer wallet" checked={form.walletEnabled} onChange={(value) => update('walletEnabled', value)} /></div><div className="module-toggle"><div><strong>Loyalty points</strong><p className="workspace-hint">Let customers earn points and work toward rewards.</p></div><SettingsToggle ariaLabel="Enable loyalty points" checked={form.pointsEnabled} onChange={(value) => update('pointsEnabled', value)} /></div>
    <div className="module-grid"><Field label={`Points earned per ${symbol} 1.00 spent`} name="pointsPerMajorUnit" type="number" min={0} max={1000} step="any" required value={form.pointsPerMajorUnit} errors={error?.fieldErrors} onChange={(e) => update('pointsPerMajorUnit', e.target.value)} /><Field label={`Wallet value per point (${symbol})`} name="pointsValueMinor" type="number" min={0} step="0.01" required value={form.pointValue} errors={error?.fieldErrors} onChange={(e) => update('pointValue', e.target.value)} /><Field label="Weekly streak bonus (points)" name="streakBonusPoints" type="number" min={0} step={1} required value={form.streakBonusPoints} errors={error?.fieldErrors} onChange={(e) => update('streakBonusPoints', e.target.value)} /></div><p className="workspace-hint">For example, 0.01 points per 1.00 spent earns 1 point per 100. A streak bonus is earned once a week for ordering in consecutive weeks.</p><div className="workspace-actions"><button className={primaryClass}>{busy ? 'Saving…' : 'Save loyalty rules'}</button><button type="button" className={buttonClass} onClick={() => { setForm(loyaltyForm(data)); onDirty(false); setError(null); setNotice('') }}>Discard changes</button></div></fieldset></form>
}
function Rewards() {
  const remote = useRemote(() => tenant.get('loyalty/rewards'), [])
  const [editor, setEditor] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const rows = [...rowsOf(remote.data?.data, 'rewards')].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  const toggle = async (reward) => { setBusy(true); setError(null); try { await tenant.patch(`loyalty/rewards/${reward.id}`, { isActive: !reward.isActive }); await remote.refresh() } catch (err) { setError(err) } finally { setBusy(false) } }
  const remove = async () => { setBusy(true); setError(null); try { await tenant.delete(`loyalty/rewards/${deleting.id}`); setDeleting(null); await remote.refresh() } catch (err) { setError(err) } finally { setBusy(false) } }
  return <section className={`${cardClass} workspace-stack`}><div className="workspace-card-heading"><div><h2>Customer rewards</h2><p className="workspace-hint">Rewards customers can work toward in the app.</p></div><div className="workspace-actions"><button className={buttonClass} disabled={remote.loading || busy} onClick={remote.refresh}>Refresh rewards</button><button className={primaryClass} onClick={() => setEditor({})}>Add reward</button></div></div><ErrorMessage error={error} /><RemoteState remote={remote} label="rewards" empty={!rows.length}><div className="workspace-grid">{rows.map((reward) => <article key={reward.id} className="workspace-stack rounded-2xl border border-[#f0ece9] p-5"><div className="workspace-card-heading"><h3 className="font-semibold">{reward.title}</h3><span className={`workspace-badge ${reward.isActive ? '' : 'workspace-badge-muted'}`}>{reward.isActive ? 'Active' : 'Hidden'}</span></div><p className="workspace-prose">{reward.description}</p><p className="text-xl font-semibold text-brand">{reward.pointsCost} points</p><p className="workspace-hint">Display position {reward.sortOrder ?? 0}</p><div className="workspace-actions"><button className={buttonClass} onClick={() => setEditor(reward)}>Edit reward</button><button className={buttonClass} disabled={busy} onClick={() => toggle(reward)}>{reward.isActive ? 'Hide reward' : 'Show reward'}</button><button className={buttonClass} onClick={() => { setError(null); setDeleting(reward) }}>Delete reward</button></div></article>)}</div></RemoteState>
    {editor && <RewardEditor reward={editor} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); await remote.refresh() }} />}
    {deleting && <CatalogModal title="Delete this reward?" busy={busy} onClose={() => setDeleting(null)}><div className="workspace-stack"><p className="workspace-hint">“{deleting.title}” will be removed from the customer rewards list.</p><ErrorMessage error={error} /><div className="workspace-actions justify-end"><button className={buttonClass} disabled={busy} onClick={() => setDeleting(null)}>Keep reward</button><button className={primaryClass} disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Confirm delete reward'}</button></div></div></CatalogModal>}
  </section>
}
function RewardEditor({ reward, onClose, onSaved }) {
  const [form, setForm] = useState({ title: reward.title || '', description: reward.description || '', pointsCost: reward.pointsCost ?? '', sortOrder: reward.sortOrder ?? 0, isActive: reward.isActive ?? true })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const save = async (event) => { event.preventDefault(); setBusy(true); setError(null); try { const body = rewardBody(form, reward.id ? reward : null); if (reward.id) { if (Object.keys(body).length) await tenant.patch(`loyalty/rewards/${reward.id}`, body) } else await tenant.post('loyalty/rewards', body); await onSaved() } catch (err) { setError(err) } finally { setBusy(false) } }
  return <CatalogModal title={reward.id ? 'Edit customer reward' : 'Add customer reward'} busy={busy} onClose={onClose}><form className="workspace-stack" onSubmit={save}><ErrorMessage error={error} /><fieldset disabled={busy} className="workspace-stack"><Field label="Reward title" name="title" value={form.title} required maxLength={80} errors={error?.fieldErrors} onChange={(e) => setForm({ ...form, title: e.target.value })} /><Textarea label="Reward description" name="description" value={form.description} maxLength={300} errors={error?.fieldErrors} onChange={(e) => setForm({ ...form, description: e.target.value })} /><div className="module-grid"><Field label="Points cost" name="pointsCost" type="number" min={1} step={1} required value={form.pointsCost} errors={error?.fieldErrors} onChange={(e) => setForm({ ...form, pointsCost: e.target.value })} /><Field label="Display position" name="sortOrder" type="number" min={0} step={1} required value={form.sortOrder} errors={error?.fieldErrors} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></div><div className="module-toggle"><span>Visible to customers</span><SettingsToggle ariaLabel="Reward visibility" checked={form.isActive} onChange={(value) => setForm({ ...form, isActive: value })} /></div><div className="workspace-actions justify-end"><button type="button" className={buttonClass} onClick={onClose}>Cancel</button><button className={primaryClass}>{busy ? 'Saving…' : 'Save reward'}</button></div></fieldset></form></CatalogModal>
}
