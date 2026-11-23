import { useState } from 'react'
import { changes, tenant, toMinor } from '../../lib/tenant'
import { Modal, Field, ErrorMessage, buttonClass, primaryClass } from '../shared/ApiUI'

export function BranchForm({ branch, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ name: branch.name || '', addressLine1: branch.addressLine1 || '', addressLine2: branch.addressLine2 || '', area: branch.area || '', city: branch.city || '', phone: branch.phone || '', acceptsDelivery: branch.acceptsDelivery ?? true, acceptsPickup: branch.acceptsPickup ?? true, deliveryFee: String((branch.deliveryFee || 0) / 100), minimumOrder: String((branch.minimumOrder || 0) / 100), prepTimeMinutes: branch.prepTimeMinutes ?? 30 }))
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const save = async (event) => {
    event.preventDefault(); setError(null); setBusy(true)
    try {
      const body = { ...form, name: form.name.trim(), addressLine1: form.addressLine1.trim(), city: form.city.trim(), addressLine2: form.addressLine2.trim() || null, area: form.area.trim() || null, phone: form.phone.trim() || null, deliveryFee: toMinor(form.deliveryFee), minimumOrder: toMinor(form.minimumOrder), prepTimeMinutes: Number(form.prepTimeMinutes) }
      const patch = changes(branch, body)
      const result = branch.id ? Object.keys(patch).length ? await tenant.patch(`branches/${branch.id}`, patch) : { data: branch } : await tenant.post('branches', body)
      await onSaved(result.data, !branch.id)
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  const update = (name, value) => setForm((previous) => ({ ...previous, [name]: value }))
  return <Modal title={branch.id ? 'Edit Branch' : 'Add Branch'} onClose={onClose} busy={busy}><form onSubmit={save} className="flex flex-col gap-4"><ErrorMessage error={error} />
    {['name', 'addressLine1', 'addressLine2', 'area', 'city', 'phone'].map((name) => <Field key={name} name={name} label={{ name: 'Branch name', addressLine1: 'Address', addressLine2: 'Address line 2', area: 'Area', city: 'City', phone: 'Phone' }[name]} value={form[name]} required={['name', 'addressLine1', 'city'].includes(name)} errors={error?.fieldErrors} onChange={(event) => update(name, event.target.value)} />)}
    <div className="grid grid-cols-2 gap-3">{['deliveryFee', 'minimumOrder', 'prepTimeMinutes'].map((name) => <Field key={name} label={{ deliveryFee: 'Delivery fee', minimumOrder: 'Minimum order', prepTimeMinutes: 'Preparation time (minutes)' }[name]} name={name} type="number" min={name === 'prepTimeMinutes' ? 1 : 0} step={name === 'prepTimeMinutes' ? 1 : '0.01'} required value={form[name]} onChange={(event) => update(name, event.target.value)} errors={error?.fieldErrors} />)}</div>
    {['acceptsDelivery', 'acceptsPickup'].map((name) => <Field key={name} name={name} label={name === 'acceptsDelivery' ? 'Delivery orders' : 'Pickup orders'} errors={error?.fieldErrors}><input type="checkbox" checked={form[name]} disabled={form[name] && !form[name === 'acceptsDelivery' ? 'acceptsPickup' : 'acceptsDelivery']} onChange={(event) => update(name, event.target.checked)} /></Field>)}
    {error?.fieldErrors?.plan && <ErrorMessage error={error.fieldErrors.plan} />}
    <div className="flex justify-end gap-3"><button type="button" disabled={busy} className={buttonClass} onClick={onClose}>Cancel</button><button className={primaryClass} disabled={busy}>{busy ? 'Saving…' : 'Save branch'}</button></div>
  </form></Modal>
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
