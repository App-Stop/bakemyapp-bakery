import { Skeleton } from '../shared/Skeleton'
import { useState } from 'react'
import { can, changes, tenant, toMinor } from '../../lib/tenant'
import { useTenant } from '../../lib/TenantContext'
import { useRemote } from '../../lib/useRemote'
import { Modal, Field, ErrorMessage, buttonClass, primaryClass } from '../shared/ApiUI'
import { CatalogModal, CatalogField, DesignIcon } from '../shared/CatalogUI'
import { SettingsToggle } from '../settings/SettingsToggle'

function BranchDivider() {
  return <div className="catalog-asset-divider"><DesignIcon file="269d1" /></div>
}

function EmployeeAccess({ branchId }) {
  const { user } = useTenant()
  const allowed = can(user, 'team:view')
  const team = useRemote(() => branchId && allowed ? tenant.list('team', { branchId, role: 'branch_staff', status: 'active', limit: 100 }) : Promise.resolve(null), [branchId, allowed])
  return <section className="branch-employee-access"><div><h3>Employee Access</h3><p>Branch staff sign in with their own email and password. Each employee manages their password.</p></div>
    {branchId && allowed ? <><ErrorMessage error={team.error} />{team.loading && !team.data && <Skeleton label="Loading staff accounts" fields={2} />}{team.data?.data?.map((member) => <div className="catalog-field-row" key={member.id}><CatalogField label="Staff email" value={member.email} readOnly /><CatalogField label="Password" value="Managed by employee" readOnly /></div>)}{!team.loading && !team.error && !team.data?.data?.length && <p>No active staff accounts assigned to this branch.</p>}</> : <p>{branchId ? 'Ask your account owner to manage branch staff access.' : 'Assign staff accounts to this branch after creating it.'}</p>}
  </section>
}

function DeleteBranchConfirmation({ branch, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const remove = async () => {
    setBusy(true); setError(null)
    try { const result = await tenant.delete(`branches/${branch.id}`); await onDeleted(result.data) } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return <CatalogModal title="Delete branch?" className="branch-delete-modal" onClose={onClose} busy={busy}>
    <div className="branch-delete-message"><span className="branch-warning-icon"><DesignIcon file="eb732" folder="branches" /></span><h3>Delete branch?</h3><p>This will deactivate {branch.name} and stop new orders. Its configuration and order history will be kept. You can restore it from Inactive branches.</p></div>
    <ErrorMessage error={error} /><div className="branch-delete-actions"><button className="catalog-button branch-destructive" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Yes, Delete'}</button><button autoFocus className="catalog-button" disabled={busy} onClick={onClose}>Cancel</button></div>
  </CatalogModal>
}

export function BranchForm({ branch, onClose, onSaved, onOpenHours }) {
  const [current, setCurrent] = useState(branch)
  const [form, setForm] = useState(() => ({ name: branch.name || '', addressLine1: branch.addressLine1 || '', addressLine2: branch.addressLine2 || '', area: branch.area || '', city: branch.city || '', phone: branch.phone || '', acceptsDelivery: branch.acceptsDelivery ?? true, acceptsPickup: branch.acceptsPickup ?? true, deliveryFee: String((branch.deliveryFee || 0) / 100), minimumOrder: String((branch.minimumOrder || 0) / 100), prepTimeMinutes: branch.prepTimeMinutes ?? 30 }))
  const [branchOpen, setBranchOpen] = useState(branch.isActive !== false && branch.isAcceptingOrders !== false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const save = async (event) => {
    event.preventDefault(); setError(null); setBusy(true)
    try {
      const body = { ...form, name: form.name.trim(), addressLine1: form.addressLine1.trim(), city: form.city.trim(), addressLine2: form.addressLine2.trim() || null, area: form.area.trim() || null, phone: form.phone.trim() || null, deliveryFee: toMinor(form.deliveryFee), minimumOrder: toMinor(form.minimumOrder), prepTimeMinutes: Number(form.prepTimeMinutes) }
      if (current.id && !current.isActive && branchOpen) body.isActive = true
      const patch = changes(current, body)
      const result = current.id ? Object.keys(patch).length ? await tenant.patch(`branches/${current.id}`, patch) : { data: current } : await tenant.post('branches', body)
      // Keep the saved ID and state if changing order acceptance fails, so retrying
      // never creates a second branch or repeats an already successful edit.
      let saved = result.data
      setCurrent(saved)
      if (saved.isActive && saved.isAcceptingOrders !== branchOpen) {
        saved = (await tenant.post(`branches/${saved.id}/pause`, { paused: !branchOpen })).data
        setCurrent(saved)
      }
      await onSaved(saved, !branch.id)
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  const update = (name, value) => setForm((previous) => ({ ...previous, [name]: value }))
  if (confirmDelete) return <DeleteBranchConfirmation branch={current} onClose={() => setConfirmDelete(false)} onDeleted={(saved) => onSaved(saved, false)} />
  return <CatalogModal title={current.id ? 'Edit Branch' : 'Add Branch'} wide className="branch-form-modal" onClose={onClose} busy={busy}><form onSubmit={save} className="catalog-form"><ErrorMessage error={error} /><fieldset disabled={busy} className="catalog-form">
    <div className="catalog-form-fields">
      <CatalogField label="Branch Name" name="name" value={form.name} onChange={(event) => update('name', event.target.value)} required maxLength={100} errors={error?.fieldErrors} />
      <div className="catalog-field-row"><CatalogField label="Branch ID" value={current.id || 'Assigned on creation'} readOnly /><CatalogField label="Phone" name="phone" type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} errors={error?.fieldErrors} /></div>
      <CatalogField label="Address" name="addressLine1" value={form.addressLine1} onChange={(event) => update('addressLine1', event.target.value)} required errors={error?.fieldErrors} />
      <CatalogField label="City" name="city" value={form.city} onChange={(event) => update('city', event.target.value)} required errors={error?.fieldErrors} />
    </div>
    <BranchDivider /><EmployeeAccess branchId={current.id} /><BranchDivider />
    <div className="branch-switches">{[
      ['acceptsPickup', 'Pickup Orders', 'Allow customers to place pickup orders at this branch'],
      ['acceptsDelivery', 'Delivery Orders', 'Allow customers to request delivery from this branch'],
      ['branchOpen', 'Branch Open', "When off, this branch won't accept any new orders"],
    ].map(([name, label, description]) => <div key={name} className="branch-switch-row"><div><h3>{label}</h3><p>{description}</p></div><SettingsToggle ariaLabel={label} checked={name === 'branchOpen' ? branchOpen : form[name]} disabled={name !== 'branchOpen' && form[name] && !form[name === 'acceptsPickup' ? 'acceptsDelivery' : 'acceptsPickup']} onChange={(value) => name === 'branchOpen' ? setBranchOpen(value) : update(name, value)} /></div>)}</div>
    <details className="catalog-form-advanced branch-order-settings" open={!!error?.fieldErrors && Object.keys(error.fieldErrors).some((key) => ['area', 'addressLine2', 'deliveryFee', 'minimumOrder', 'prepTimeMinutes'].includes(key)) || undefined}><summary aria-label="Address & ordering settings"><span>Address & ordering settings</span><small>Set delivery fees, minimum orders and preparation time.</small></summary><div>
      <div className="catalog-field-row">{['addressLine2', 'area'].map((name) => <CatalogField key={name} name={name} label={name === 'area' ? 'Area' : 'Address line 2'} value={form[name]} onChange={(event) => update(name, event.target.value)} errors={error?.fieldErrors} />)}</div>
      <div className="branch-price-fields">{['deliveryFee', 'minimumOrder', 'prepTimeMinutes'].map((name) => <CatalogField key={name} label={{ deliveryFee: 'Delivery fee', minimumOrder: 'Minimum order', prepTimeMinutes: 'Preparation time (minutes)' }[name]} name={name} type="number" min={name === 'prepTimeMinutes' ? 1 : 0} step={name === 'prepTimeMinutes' ? 1 : '0.01'} required value={form[name]} onChange={(event) => update(name, event.target.value)} errors={error?.fieldErrors} />)}</div>
      {current.id && <button type="button" className="catalog-button" onClick={() => onOpenHours(current)}>Opening hours</button>}
    </div></details>
    {current.id && <section className="branch-danger-zone"><h3>Danger Zone</h3><p>Deactivate this branch to stop new orders and free a place on your plan. Its configuration and order history will be kept.</p><button type="button" className="branch-destructive" onClick={() => setConfirmDelete(true)}><DesignIcon file="8986e" folder="branches" />Delete Branch</button></section>}
    <div className="catalog-form-footer"><button type="button" disabled={busy} className="catalog-button" onClick={onClose}>Cancel</button><button className="catalog-button catalog-primary" disabled={busy}>{busy ? 'Saving…' : current.id ? 'Save Changes' : 'Add Branch'}</button></div>
  </fieldset></form></CatalogModal>
}

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export function BranchHours({ branch, onClose, onSaved, editable }) {
  const [hours, setHours] = useState(() => days.map((_, index) => { const saved = branch.hours?.find((hour) => hour.day === index + 1); return { day: index + 1, isClosed: saved?.isClosed ?? false, opensAt: saved?.opensAt || '09:00', closesAt: saved?.closesAt || '21:00' } }))
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const update = (index, patch) => setHours((previous) => previous.map((row, i) => i === index ? { ...row, ...patch } : row))
  const copy = (count) => setHours((previous) => previous.map((row, index) => index < count ? { ...previous[0], day: row.day } : row))
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError(null)
    try {
      const invalid = hours.findIndex((hour) => !hour.isClosed && hour.closesAt <= hour.opensAt)
      if (invalid >= 0) { const err = new Error('Closing time must be after opening time.'); err.fieldErrors = { [`hours.${invalid}.closesAt`]: err.message }; throw err }
      await tenant.put(`branches/${branch.id}/hours`, { hours: hours.map((hour) => hour.isClosed ? { day: hour.day, isClosed: true } : hour) })
      await onSaved(); onClose()
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return <Modal title={`${branch.name} · Opening hours`} onClose={onClose} busy={busy}><form onSubmit={save} className="flex flex-col gap-4"><ErrorMessage error={error} /><p className="text-xs text-muted">Times use the bakery’s time zone. For midnight, use 23:59; a row cannot cross midnight.</p><fieldset disabled={!editable || busy} className="flex flex-col gap-4"><div className="flex gap-2"><button type="button" className={buttonClass} onClick={() => copy(7)}>Copy Monday to all</button><button type="button" className={buttonClass} onClick={() => copy(5)}>Copy to weekdays</button></div>{hours.map((hour, index) => <div key={hour.day} className="flex flex-col gap-2 border-b border-gray-100 pb-3"><div className="flex items-center justify-between"><span>{days[index]}</span><label className="text-sm"><input type="checkbox" checked={hour.isClosed} onChange={(event) => update(index, { isClosed: event.target.checked })} /> Closed</label></div>{!hour.isClosed && <div className="grid grid-cols-2 gap-3"><Field label="Opens" type="time" required name={`hours.${index}.opensAt`} value={hour.opensAt} errors={error?.fieldErrors} onChange={(event) => update(index, { opensAt: event.target.value })} /><Field label="Closes" type="time" required name={`hours.${index}.closesAt`} value={hour.closesAt} errors={error?.fieldErrors} onChange={(event) => update(index, { closesAt: event.target.value })} /></div>}{error?.fieldErrors?.[`hours.${index}.day`] && <ErrorMessage error={error.fieldErrors[`hours.${index}.day`]} />}</div>)}</fieldset>{editable && <button className={primaryClass} disabled={busy}>{busy ? 'Saving…' : 'Save opening hours'}</button>}</form></Modal>
}
