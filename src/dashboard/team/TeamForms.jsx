import { Skeleton } from '../shared/Skeleton'
import { useState } from 'react'
import { tenant } from '../../lib/tenant'
import { useTenant } from '../../lib/TenantContext'
import { useRemote } from '../../lib/useRemote'
import { ErrorMessage } from '../shared/ApiUI'
import { CatalogModal, CatalogField } from '../shared/CatalogUI'
import { canChangeAccess, canManageMember, invitationBody, memberPatch, when } from './teamHelpers'

export function TeamForm({ member, invite, roles, branches, onClose, onSaved }) {
  const { user } = useTenant()
  const original = member || invite
  const [form, setForm] = useState(() => ({ name: original?.name || '', email: original?.email || '', role: original?.role || roles.find((role) => role.assignable)?.key || '', branchId: original?.branch?.id || '' }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const role = roles.find((item) => item.key === form.role)
  const accessEditable = !member || canChangeAccess(user, member)
  const update = (key, value) => setForm((previous) => ({ ...previous, [key]: value }))
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError(null)
    try {
      if (member) {
        const patch = memberPatch(member, form, roles, user)
        if (Object.keys(patch).length) await tenant.patch(`team/${member.id}`, patch)
      } else await tenant.post('team/invites', invitationBody(form, roles))
      await onSaved()
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return <CatalogModal title={member ? 'Edit team member' : invite ? 'Resend invitation' : 'Invite team member'} description={member ? 'Update their name, role and branch access.' : invite ? 'Sending again replaces the previous invitation link.' : 'They will receive an email to choose their password.'} onClose={onClose} busy={busy}>
    <form className="catalog-form" onSubmit={save}><ErrorMessage error={error} /><fieldset disabled={busy} className="catalog-form">
      <CatalogField label={member ? 'Name' : 'Name (optional)'} name="name" value={form.name} onChange={(event) => update('name', event.target.value)} required={!!member} errors={error?.fieldErrors} />
      <CatalogField label="Email" name="email" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} required readOnly={!!member} errors={error?.fieldErrors} />
      {accessEditable && <><CatalogField label="Role" name="role" errors={error?.fieldErrors}><select name="role" required value={form.role} onChange={(event) => update('role', event.target.value)} aria-invalid={!!error?.fieldErrors?.role}><option value="" disabled>Select a role</option>{roles.map((item) => <option key={item.key} value={item.key} disabled={!item.assignable}>{item.name}{!item.assignable ? ' (unavailable)' : ''}</option>)}</select></CatalogField>
        {role?.requiresBranch && <CatalogField label="Branch" name="branchId" errors={error?.fieldErrors}><select name="branchId" value={form.branchId} onChange={(event) => update('branchId', event.target.value)} required aria-invalid={!!error?.fieldErrors?.branchId}><option value="">Select a branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id} disabled={!branch.isActive}>{branch.name}{!branch.isActive ? ' (inactive)' : ''}</option>)}</select></CatalogField>}</>}
      {!accessEditable && <p className="text-sm text-muted">Ask another owner to change your role or account access.</p>}
      <div className="team-actions"><button type="button" className="catalog-button" onClick={onClose}>Cancel</button><button type="submit" className="catalog-button catalog-primary" disabled={busy || (accessEditable && (!role || (!member && !role.assignable)))}>{busy ? 'Saving…' : member ? 'Save changes' : invite ? 'Resend invitation' : 'Send invitation'}</button></div>
    </fieldset></form>
  </CatalogModal>
}

export function TeamConfirmation({ title, description, actionLabel, action, onClose, onSaved }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const submit = async () => {
    setBusy(true); setError(null)
    try { await action(); await onSaved() } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return <CatalogModal title={title} description={description} onClose={onClose} busy={busy}><ErrorMessage error={error} /><div className="team-actions"><button autoFocus className="catalog-button" disabled={busy} onClick={onClose}>Keep unchanged</button><button className="catalog-button catalog-primary" disabled={busy} onClick={submit}>{busy ? 'Updating…' : actionLabel}</button></div></CatalogModal>
}

export function TeamDetails({ id, roles, branches, onClose, onSaved }) {
  const { user } = useTenant()
  const detail = useRemote(() => tenant.get(`team/${id}`), [id])
  const [editing, setEditing] = useState(false)
  const [confirmation, setConfirmation] = useState(null)
  const member = detail.data?.data
  const refresh = async () => { setConfirmation(null); setEditing(false); await Promise.all([detail.refresh(), onSaved()]) }
  if (editing) return <TeamForm member={member} roles={roles} branches={branches} onClose={() => setEditing(false)} onSaved={refresh} />
  if (confirmation) return <TeamConfirmation {...confirmation} onClose={() => setConfirmation(null)} onSaved={refresh} />
  const confirm = (title, description, actionLabel, action) => setConfirmation({ title, description, actionLabel, action })
  return <CatalogModal title="Team member details" onClose={onClose}>
    <ErrorMessage error={detail.error} />{detail.error && <button className="catalog-button" onClick={detail.refresh}>Try again</button>}
    {detail.loading && !detail.data && <Skeleton variant="detail" label="Loading team member" />}
    {member && <div className="team-detail"><div><h3>{member.name}</h3><p>{member.email}</p></div><dl><div><dt>Role</dt><dd>{member.roleName}</dd></div><div><dt>Branch</dt><dd>{member.branch?.name || 'All branches'}</dd></div><div><dt>Status</dt><dd>{member.isActive ? 'Active' : 'Switched off'}{member.isLocked ? ' · Locked' : ''}</dd></div><div><dt>Last login (Karachi)</dt><dd>{when(member.lastLoginAt)}</dd></div><div><dt>Sessions</dt><dd>Signed in on {member.activeSessions} devices</dd></div>{member.isLocked && <div><dt>Locked until (Karachi)</dt><dd>{when(member.lockedUntil)}</dd></div>}</dl>
      {canManageMember(user, member) && <div className="team-actions">
        <button className="catalog-button" disabled={detail.loading || !roles.length} onClick={() => setEditing(true)}>Edit member</button>
        {canChangeAccess(user, member) && <button className="catalog-button" disabled={detail.loading} onClick={() => confirm(member.isActive ? 'Switch off account?' : 'Switch on account?', member.isActive ? `${member.name} will be signed out on every device and cannot sign in again until switched on.` : `${member.name} will be able to sign in again.`, member.isActive ? 'Switch off' : 'Switch on', () => tenant.patch(`team/${id}`, { isActive: !member.isActive }))}>{member.isActive ? 'Switch off' : 'Switch on'}</button>}
        <button className="catalog-button" disabled={detail.loading} onClick={() => confirm('Sign out everywhere?', `${member.name} will be signed out on every device. They can sign in again.`, 'Sign out everywhere', () => tenant.post(`team/${id}/revoke-sessions`))}>Sign out everywhere</button>
        {member.isLocked && <button className="catalog-button" disabled={detail.loading} onClick={() => confirm('Unlock account?', `${member.name} can try signing in again immediately.`, 'Unlock account', () => tenant.post(`team/${id}/unlock`))}>Unlock account</button>}
      </div>}
      <section><h3>Permissions</h3><p className="team-permissions">{member.permissions?.map((permission) => permission === '*' ? 'Full access' : permission).join(', ') || 'No permissions'}</p></section>
      <section><h3>Recent activity</h3><ul className="team-activity">{member.recentActivity?.map((activity) => <li key={activity.id}><span>{activity.action}</span><time dateTime={activity.createdAt}>{when(activity.createdAt)}</time></li>)}</ul>{!member.recentActivity?.length && <p>No recent activity.</p>}</section>
    </div>}
  </CatalogModal>
}
