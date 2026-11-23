import { useState } from 'react'
import { changes, tenant, toMinor } from '../../lib/tenant'
import { useRemote } from '../../lib/useRemote'
import { Modal, Field, ErrorMessage, buttonClass, primaryClass } from '../shared/ApiUI'

export function CategoryForm({ category, onClose, onSaved }) {
  const [name, setName] = useState(category.name || '')
  const [description, setDescription] = useState(category.description || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const run = async (action) => { setBusy(true); setError(null); try { await action(); await onSaved(); onClose() } catch (err) { setError(err) } finally { setBusy(false) } }
  const save = (event) => {
    event.preventDefault()
    const body = { name: name.trim(), description: description.trim() || null }
    const patch = changes(category, body)
    run(() => category.id ? Object.keys(patch).length ? tenant.patch(`menu/categories/${category.id}`, patch) : Promise.resolve() : tenant.post('menu/categories', body))
  }
  return <Modal title={category.id ? 'Edit Category' : 'Add Category'} onClose={onClose} busy={busy}><form onSubmit={save} className="flex flex-col gap-4"><ErrorMessage error={error} /><Field label="Category name" name="name" value={name} onChange={(event) => setName(event.target.value)} required errors={error?.fieldErrors} /><Field label="Description" name="description" value={description} onChange={(event) => setDescription(event.target.value)} errors={error?.fieldErrors} /><div className="flex flex-wrap justify-end gap-2">{category.id && <button type="button" className={buttonClass} disabled={busy} onClick={() => { if (category.isActive) { if (window.confirm(`Switch off ${category.name}? Products in this category will no longer appear to customers.`)) run(() => tenant.delete(`menu/categories/${category.id}`)) } else run(() => tenant.patch(`menu/categories/${category.id}`, { isActive: true })) }}>{category.isActive ? 'Switch off' : 'Switch on'}</button>}<button className={primaryClass} disabled={busy}>{busy ? 'Saving…' : 'Save category'}</button></div></form></Modal>
}

async function validatePhoto(file) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG or WebP image.')
  if (file.size > 5 * 1024 * 1024) throw new Error('The photo must be at most 5 MB.')
  const bitmap = await createImageBitmap(file)
  const valid = bitmap.width >= 200 && bitmap.height >= 200 && bitmap.width <= 4096 && bitmap.height <= 4096
  bitmap.close()
  if (!valid) throw new Error('The photo must be 200 to 4096 pixels on each side.')
}

export function ProductEditor({ product, categories, symbol = 'Rs', onClose, onSaved }) {
  const [current, setCurrent] = useState(product)
  const [name, setName] = useState(product.name || '')
  const [description, setDescription] = useState(product.description || '')
  const [categoryId, setCategoryId] = useState(product.category?.id || categories[0]?.id || '')
  const [price, setPrice] = useState(product.price == null ? '' : String(product.price / 100))
  const [hasSizes, setHasSizes] = useState(product.hasSizes || false)
  const [sizes, setSizes] = useState(product.sizes?.map((size) => ({ ...size, price: String(size.price / 100) })) || [])
  const [addonSetIds, setAddonSetIds] = useState(product.addonSets?.filter((set) => set.isActive !== false).map((set) => set.id) || [])
  const [unavailable, setUnavailable] = useState(product.branches?.filter((branch) => !branch.available).map((branch) => branch.id) || [])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const addonSets = useRemote(() => tenant.list('menu/addon-sets'), [])
  const run = async (action) => {
    setBusy(true); setError(null); setNotice('')
    try { const result = await action(); if (result?.data) setCurrent(result.data); await onSaved(); setNotice('Saved.') } catch (err) { setError(err) } finally { setBusy(false) }
  }
  const sizeBody = () => hasSizes ? { sizes: sizes.map((size) => ({ ...(size.id ? { id: size.id } : {}), name: size.name.trim(), price: toMinor(size.price) })) } : { sizes: [], price: toMinor(price) }
  const saveDetails = (event) => {
    event.preventDefault()
    run(async () => {
      const body = { name: name.trim(), description: description.trim() || null, categoryId, ...(!current.hasSizes && current.id ? { price: toMinor(price) } : {}) }
      if (!current.id) { const result = await tenant.post('menu/products', { name: body.name, description: body.description, categoryId, ...(hasSizes ? sizeBody() : { price: toMinor(price) }) }); setSizes(result.data.sizes?.map((size) => ({ ...size, price: String(size.price / 100) })) || []); return result }
      const patch = changes({ ...current, categoryId: current.category?.id }, body)
      return Object.keys(patch).length ? tenant.patch(`menu/products/${current.id}`, patch) : { data: current }
    })
  }
  const toggle = (setter, id) => setter((previous) => previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id])
  const sizeFields = <div className="flex flex-col gap-3"><label className="text-sm"><input type="checkbox" checked={hasSizes} onChange={(event) => { setHasSizes(event.target.checked); if (event.target.checked && !sizes.length) setSizes([{ name: '', price: '' }]) }} /> Has sizes</label>{hasSizes ? <>{sizes.map((size, index) => <div key={size.id || index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"><Field label="Size" name={`sizes.${index}.name`} value={size.name} required errors={error?.fieldErrors} onChange={(event) => setSizes((previous) => previous.map((row, i) => i === index ? { ...row, name: event.target.value } : row))} /><Field label={`Price (${symbol})`} name={`sizes.${index}.price`} type="number" min="0.01" step="0.01" value={size.price} required errors={error?.fieldErrors} onChange={(event) => setSizes((previous) => previous.map((row, i) => i === index ? { ...row, price: event.target.value } : row))} /><button type="button" className={buttonClass} disabled={sizes.length === 1} aria-label={`Remove size ${index + 1}`} onClick={() => setSizes((previous) => previous.filter((_, i) => i !== index))}>×</button></div>)}<button type="button" className={buttonClass} onClick={() => setSizes((previous) => [...previous, { name: '', price: '' }])}>Add size</button></> : <Field label={`Price (${symbol})`} name="price" type="number" min="0.01" step="0.01" value={price} required onChange={(event) => setPrice(event.target.value)} errors={error?.fieldErrors} />}</div>
  return <Modal title={current.id ? 'Edit Item' : 'Add New Item'} onClose={onClose} busy={busy}><ErrorMessage error={error} />{notice && <p role="status" className="text-sm text-green-700">{notice}</p>}<fieldset disabled={busy} className="flex min-w-0 flex-col gap-5">
    <form onSubmit={saveDetails} className="flex flex-col gap-4"><Field label="Product name" name="name" value={name} required onChange={(event) => setName(event.target.value)} errors={error?.fieldErrors} /><Field label="Description" name="description" value={description} onChange={(event) => setDescription(event.target.value)} errors={error?.fieldErrors} /><Field label="Category" name="categoryId" errors={error?.fieldErrors}><select value={categoryId} required onChange={(event) => setCategoryId(event.target.value)} className={buttonClass}>{!categories.some((category) => category.id === categoryId) && <option value={categoryId}>{current.category?.name}</option>}{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>{!current.id ? sizeFields : !current.hasSizes && <Field label={`Price (${symbol})`} name="price" type="number" min="0.01" step="0.01" required value={price} onChange={(event) => setPrice(event.target.value)} errors={error?.fieldErrors} />}<button className={primaryClass}>{current.id ? 'Save details' : 'Create product'}</button></form>
    {current.id && <><form onSubmit={(event) => { event.preventDefault(); run(async () => { const result = await tenant.put(`menu/products/${current.id}/sizes`, sizeBody()); setSizes(result.data.sizes?.map((size) => ({ ...size, price: String(size.price / 100) })) || []); setHasSizes(result.data.hasSizes); if (!result.data.hasSizes) setPrice(String(result.data.price / 100)); return result }) }} className="flex flex-col gap-3 border-t border-gray-100 pt-4"><h3 className="font-semibold">Sizes and pricing</h3>{sizeFields}<button className={buttonClass}>Save sizes</button></form>
      <section className="flex flex-col gap-3 border-t border-gray-100 pt-4"><h3 className="font-semibold">Product photo</h3>{current.photo?.url && <img src={current.photo.url} alt={current.name} className="size-32 rounded-xl object-cover" />}<Field label="PNG, JPEG or WebP · 200–4096 px · up to 5 MB" name="photo" errors={error?.fieldErrors}><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) run(async () => { await validatePhoto(file); return tenant.post(`menu/products/${current.id}/photo`, file) }) }} /></Field>{current.photo && <button className={buttonClass} onClick={() => { if (window.confirm('Remove this photo?')) run(() => tenant.delete(`menu/products/${current.id}/photo`)) }}>Remove photo</button>}</section>
      <section className="flex flex-col gap-3 border-t border-gray-100 pt-4"><h3 className="font-semibold">Add-on groups</h3><ErrorMessage error={addonSets.error} />{addonSets.data?.data?.map((set) => <label key={set.id} className="text-sm"><input type="checkbox" checked={addonSetIds.includes(set.id)} onChange={() => toggle(setAddonSetIds, set.id)} /> {set.name}</label>)}<button className={buttonClass} disabled={!addonSets.data} onClick={() => run(() => tenant.put(`menu/products/${current.id}/addon-sets`, { addonSetIds }))}>Save add-on groups</button></section>
      <section className="flex flex-col gap-3 border-t border-gray-100 pt-4"><h3 className="font-semibold">Branches selling this item</h3>{current.branches?.map((branch) => <label key={branch.id} className="text-sm"><input type="checkbox" checked={!unavailable.includes(branch.id)} onChange={() => toggle(setUnavailable, branch.id)} /> {branch.name}</label>)}<button className={buttonClass} onClick={() => run(() => tenant.put(`menu/products/${current.id}/branches`, { unavailableBranchIds: unavailable }))}>Save branch availability</button></section>
    </>}
  </fieldset></Modal>
}
