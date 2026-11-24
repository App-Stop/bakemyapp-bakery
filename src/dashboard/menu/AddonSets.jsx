import { Skeleton } from '../shared/Skeleton'
import { useState } from 'react'
import { changes, money, tenant, toMinor } from '../../lib/tenant'
import { useRemote } from '../../lib/useRemote'
import { Modal, Field, ErrorMessage, buttonClass, primaryClass, cardClass } from '../shared/ApiUI'

export function AddonSets({ status, editable, symbol }) {
  const list = useRemote(() => tenant.list('menu/addon-sets', { status }), [status])
  const [editor, setEditor] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const run = async (action) => { setError(null); setBusy(true); try { await action(); await list.refresh() } catch (err) { setError(err) } finally { setBusy(false) } }
  return <div className="flex flex-col gap-4"><div className="flex justify-end">{editable && <button className={primaryClass} onClick={() => setEditor({})}>Add group</button>}</div><ErrorMessage error={error || list.error} />{list.loading && !list.data && <Skeleton variant="cards" label="Loading add-on groups" rows={2} />}{!list.loading && !list.data?.data?.length && !list.error && <p className={cardClass}>No add-on groups found.</p>}<div className="grid gap-4 md:grid-cols-2">{list.data?.data?.map((set) => <article key={set.id} className={`${cardClass} flex flex-col gap-3`}><h2 className="font-semibold">{set.name} {!set.isActive && '(Switched off)'}</h2><p className="text-sm text-muted">{set.minSelect === 0 ? 'Optional' : `Pick at least ${set.minSelect}`} · {set.maxSelect == null ? 'Any number' : `Up to ${set.maxSelect}`} · {set.productCount} products</p>{set.options?.map((option) => <p key={option.id} className="text-sm">{option.name} · {money(option.price, symbol)}{!option.isAvailable && ' · Sold out'}</p>)}{editable && <div className="flex gap-2"><button disabled={busy} className={buttonClass} onClick={() => run(async () => setEditor((await tenant.get(`menu/addon-sets/${set.id}`)).data))}>Edit</button><button disabled={busy} className={buttonClass} onClick={() => { if (!set.isActive) run(() => tenant.patch(`menu/addon-sets/${set.id}`, { isActive: true })); else if (window.confirm(`Switch off ${set.name}?`)) run(() => tenant.delete(`menu/addon-sets/${set.id}`)) }}>{set.isActive ? 'Switch off' : 'Switch on'}</button></div>}</article>)}</div>{editor && <AddonEditor key={editor.id || 'new'} group={editor} symbol={symbol} onClose={() => setEditor(null)} onSaved={list.refresh} />}</div>
}

function AddonEditor({ group, symbol = 'Rs', onClose, onSaved }) {
  const [current, setCurrent] = useState(group)
  const [name, setName] = useState(group.name || '')
  const [minSelect, setMin] = useState(group.minSelect ?? 0)
  const [maxSelect, setMax] = useState(group.maxSelect ?? '')
  const [options, setOptions] = useState(group.options?.map((option) => ({ ...option, price: String(option.price / 100) })) || [{ name: '', price: '0', isAvailable: true }])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const run = async (action) => { setBusy(true); setError(null); setNotice(''); try { const result = await action(); setCurrent(result.data); setOptions(result.data.options.map((option) => ({ ...option, price: String(option.price / 100) }))); await onSaved(); setNotice('Saved.') } catch (err) { setError(err) } finally { setBusy(false) } }
  const optionBody = () => options.map((option) => ({ ...(option.id ? { id: option.id } : {}), name: option.name.trim(), price: toMinor(option.price), isAvailable: option.isAvailable }))
  const save = (event) => {
    event.preventDefault()
    run(async () => {
      const body = { name: name.trim(), minSelect: Number(minSelect), maxSelect: maxSelect === '' ? null : Number(maxSelect) }
      if (!current.id) return tenant.post('menu/addon-sets', { ...body, options: optionBody() })
      const patch = changes(current, body)
      return Object.keys(patch).length ? tenant.patch(`menu/addon-sets/${current.id}`, patch) : { data: current }
    })
  }
  const optionFields = <div className="flex flex-col gap-3">{options.map((option, index) => <div key={option.id || index} className="flex flex-col gap-2 rounded-xl border border-gray-100 p-3"><div className="grid grid-cols-2 gap-2"><Field label="Option name" name={`options.${index}.name`} required value={option.name} errors={error?.fieldErrors} onChange={(event) => setOptions((previous) => previous.map((row, i) => i === index ? { ...row, name: event.target.value } : row))} /><Field label={`Extra (${symbol})`} name={`options.${index}.price`} type="number" min="0" step="0.01" required value={option.price} errors={error?.fieldErrors} onChange={(event) => setOptions((previous) => previous.map((row, i) => i === index ? { ...row, price: event.target.value } : row))} /></div><div className="flex items-center justify-between"><label className="text-sm"><input type="checkbox" checked={option.isAvailable} onChange={(event) => setOptions((previous) => previous.map((row, i) => i === index ? { ...row, isAvailable: event.target.checked } : row))} /> Available</label><button type="button" className={buttonClass} onClick={() => setOptions((previous) => previous.filter((_, i) => i !== index))}>Remove</button></div></div>)}<button type="button" className={buttonClass} onClick={() => setOptions((previous) => [...previous, { name: '', price: '0', isAvailable: true }])}>Add option</button></div>
  return <Modal title={current.id ? 'Edit add-on group' : 'Add add-on group'} busy={busy} onClose={onClose}><ErrorMessage error={error} />{notice && <p role="status" className="text-sm text-green-700">{notice}</p>}<fieldset disabled={busy} className="flex flex-col gap-5"><form onSubmit={save} className="flex flex-col gap-3"><Field label="Group name" name="name" required value={name} onChange={(event) => setName(event.target.value)} errors={error?.fieldErrors} /><div className="grid grid-cols-2 gap-3"><Field label="Minimum picks" name="minSelect" type="number" min="0" step="1" required value={minSelect} onChange={(event) => setMin(event.target.value)} errors={error?.fieldErrors} /><Field label="Maximum (blank = unlimited)" name="maxSelect" type="number" min="0" step="1" value={maxSelect} onChange={(event) => setMax(event.target.value)} errors={error?.fieldErrors} /></div>{!current.id && optionFields}<button className={primaryClass}>{current.id ? 'Save group details' : 'Create group'}</button></form>{current.id && <form onSubmit={(event) => { event.preventDefault(); run(() => tenant.put(`menu/addon-sets/${current.id}/options`, { options: optionBody() })) }} className="flex flex-col gap-3 border-t border-gray-100 pt-4"><h3 className="font-semibold">Options</h3>{optionFields}<button className={buttonClass}>Save options</button></form>}</fieldset></Modal>
}
