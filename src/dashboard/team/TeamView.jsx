import { Skeleton } from '../shared/Skeleton'
import { useEffect, useState } from 'react'
import { can, tenant } from '../../lib/tenant'
import { useTenant } from '../../lib/TenantContext'
import { useRemote } from '../../lib/useRemote'
import { ErrorMessage } from '../shared/ApiUI'
import { CatalogSearch, CatalogPagination } from '../shared/CatalogUI'
import { TeamConfirmation, TeamDetails, TeamForm } from './TeamForms'
import { canManageMember, when } from './teamHelpers'
import './team.css'

function MemberStatus({ member }) {
  return <div className="team-badges"><span className={`team-badge ${member.isActive ? 'team-active' : ''}`}>{member.isActive ? 'Active' : 'Switched off'}</span>{member.isLocked && <span className="team-badge team-locked">Locked</span>}</div>
}

export function TeamView() {
  const { user } = useTenant()
  const [tab, setTab] = useState('members')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [branchId, setBranchId] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [editor, setEditor] = useState(null)
  const [selected, setSelected] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const [notice, setNotice] = useState('')
  const editable = can(user, 'team:manage')
  useEffect(() => {
    if (search.trim() === q) return
    const timer = setTimeout(() => { setQ(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(timer)
  }, [search, q])
  const members = useRemote(() => tenant.list('team', { q, role, branchId, status, page, limit: 8 }), [q, role, branchId, status, page])
  const invites = useRemote(() => tenant.get('team/invites'), [])
  const roles = useRemote(() => tenant.get('team/roles'), [])
  const branches = useRemote(() => can(user, 'branches:view') ? tenant.list('branches', { status: 'all' }) : Promise.resolve({ data: [] }), [user.id])
  const roleList = roles.data?.data || []
  const branchList = branches.data?.data || []
  const rows = members.data?.data || []
  const invitations = invites.data?.data || []
  const ready = !!roles.data && !roles.error && !branches.error
  const refresh = async () => { await Promise.all([members.refresh(), invites.refresh()]) }
  const savedInvite = async () => { setEditor(null); setNotice('Invitation sent. The recipient can choose their password from the email.'); await refresh() }
  const filter = (setter, value) => { setter(value); setPage(1) }
  const source = tab === 'members' ? members : invites
  return <div className="team-page mx-auto flex max-w-[1360px] flex-col gap-5 lg:gap-7">
    <header className="team-header"><div><h1>Team Directory</h1><p>Manage your people, branch access, and invitations.</p></div>{editable && <button className="catalog-button catalog-primary" disabled={!ready} onClick={() => { setNotice(''); setEditor({}) }}>Invite team member</button>}</header>
    <div className="team-stats">{[
      ['Matching team members', members.data?.pagination?.totalItems],
      ['Pending invitations', invites.data ? invitations.filter((invite) => !invite.expired).length : null],
      ['Expired invitations', invites.data ? invitations.filter((invite) => invite.expired).length : null],
    ].map(([label, value]) => <section key={label}><p>{label}</p><strong>{value ?? '—'}</strong></section>)}</div>
    {notice && <p role="status" className="catalog-notice">{notice}</p>}
    <ErrorMessage error={source.error || roles.error || branches.error} />
    {(source.error || roles.error || branches.error) && <button className="catalog-button self-start" onClick={() => { refresh(); roles.refresh(); branches.refresh() }}>Try again</button>}
    <section className="team-directory" aria-label="Team directory">
      <div className="team-toolbar"><div className="catalog-tabs" role="tablist" aria-label="Team views"><button role="tab" aria-selected={tab === 'members'} onClick={() => setTab('members')}>Team members</button><button role="tab" aria-selected={tab === 'invites'} onClick={() => setTab('invites')}>Pending invitations</button></div>{tab === 'members' && <CatalogSearch label="Search team" placeholder="Search name or email..." value={search} onChange={setSearch} />}</div>
      {tab === 'members' && <div className="team-filters"><label>Role<select value={role} onChange={(event) => filter(setRole, event.target.value)}><option value="">All roles</option>{roleList.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label><label>Branch<select value={branchId} onChange={(event) => filter(setBranchId, event.target.value)}><option value="">All branches</option>{branchList.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Status<select value={status} onChange={(event) => filter(setStatus, event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Switched off</option></select></label><button className="catalog-button" onClick={refresh} disabled={source.loading}>Refresh</button></div>}
      {source.loading && !source.data && <Skeleton variant={tab === 'members' ? 'table' : 'cards'} label={tab === 'members' ? 'Loading team members' : 'Loading invitations'} columns={6} rows={5} />}
      {!source.loading && !source.error && !(tab === 'members' ? rows : invitations).length && <div className="team-empty"><h2>{tab === 'members' ? 'No team members found' : 'No pending invitations'}</h2><p>{tab === 'members' ? 'Try another search or filter.' : 'Invite someone to join your bakery.'}</p>{tab === 'members' && (search || role || branchId || status || page > 1) && <button className="catalog-button mt-4" onClick={() => { setSearch(''); setQ(''); setRole(''); setBranchId(''); setStatus(''); setPage(1) }}>Clear filters</button>}</div>}
      {tab === 'members' && !!rows.length && <>
        <div className="team-table-scroll"><table className="team-table"><thead><tr><th>Name &amp; email</th><th>Role</th><th>Branch</th><th>Status</th><th>Last login (Karachi)</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.map((member) => <tr key={member.id}><td><strong>{member.name}{member.id === user.id ? ' (you)' : ''}</strong><span>{member.email}</span></td><td>{member.roleName}</td><td>{member.branch?.name || 'All branches'}</td><td><MemberStatus member={member} /></td><td>{when(member.lastLoginAt)}</td><td><button className="catalog-button" disabled={members.loading} onClick={() => setSelected(member.id)} aria-label={`View ${member.name}`}>View details</button></td></tr>)}</tbody></table></div>
        <div className="team-mobile-list">{rows.map((member) => <article key={member.id}><div><h2>{member.name}{member.id === user.id ? ' (you)' : ''}</h2><MemberStatus member={member} /></div><p>{member.email}</p><p>{member.roleName} · {member.branch?.name || 'All branches'}</p><p>Last login: {when(member.lastLoginAt)}</p><button className="catalog-button" disabled={members.loading} onClick={() => setSelected(member.id)} aria-label={`View ${member.name}`}>View details</button></article>)}</div>
      </>}
      {tab === 'invites' && !!invitations.length && <div className="team-invites">{invitations.map((invite) => <article key={invite.id}><div><h2>{invite.name || invite.email}</h2>{invite.name && <p>{invite.email}</p>}<p>{invite.roleName} · {invite.branch?.name || 'All branches'}</p><p>Invited by {invite.invitedBy?.type === 'staff' ? 'Bake My App team' : invite.invitedBy?.name || 'Team member'}</p><p>{invite.expired ? 'Expired' : 'Expires'}: {when(invite.expiresAt)} (Karachi)</p></div><div className="team-invite-actions"><span className={`team-badge ${invite.expired ? 'team-locked' : 'team-active'}`}>{invite.expired ? 'Expired' : 'Pending'}</span>{canManageMember(user, invite) && <><button className="catalog-button" disabled={!ready || invites.loading} onClick={() => setEditor({ invite })}>Resend</button><button className="catalog-button" disabled={invites.loading} onClick={() => setConfirmation({ title: 'Cancel invitation?', description: `The invitation link for ${invite.email} will stop working immediately.`, actionLabel: 'Cancel invitation', action: () => tenant.delete(`team/invites/${invite.id}`) })}>Cancel invitation</button></>}</div></article>)}</div>}
      {tab === 'members' && <CatalogPagination pagination={members.data?.pagination} page={page} count={rows.length} noun="team members" onChange={setPage} disabled={members.loading} />}
    </section>
    {editor && <TeamForm invite={editor.invite} roles={roleList} branches={branchList} onClose={() => setEditor(null)} onSaved={savedInvite} />}
    {selected && <TeamDetails id={selected} roles={roleList} branches={branchList} onClose={() => setSelected(null)} onSaved={refresh} />}
    {confirmation && <TeamConfirmation {...confirmation} onClose={() => setConfirmation(null)} onSaved={async () => { setConfirmation(null); setNotice('Invitation cancelled.'); await invites.refresh() }} />}
  </div>
}
