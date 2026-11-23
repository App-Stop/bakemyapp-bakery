import { useEffect, useState } from 'react'
import { changes, tenant, toMinor } from '../../lib/tenant'
import { useTenant } from '../../lib/TenantContext'
import { useRemote } from '../../lib/useRemote'
import { Field, ErrorMessage, buttonClass } from '../shared/ApiUI'
import { CatalogModal, CatalogField, DesignIcon } from '../shared/CatalogUI'
import { SettingsToggle } from '../settings/SettingsToggle'
import { categoryIcon, categoryIcons, saveCategoryIcon } from './categoryIcons'

export function CategoryForm({ category, onClose, onSaved }) {
  const { user } = useTenant()
  const scope = user.tenant?.id || user.id
  const [name, setName] = useState(category.name || '')
  const [description, setDescription] = useState(category.description || '')
  const [icon, setIcon] = useState(category.id ? categoryIcon(category, scope).id : 'donut')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const run = async (action) => { setBusy(true); setError(null); try { await action(); await onSaved(); onClose() } catch (err) { setError(err) } finally { setBusy(false) } }
  const save = (event) => {
    event.preventDefault()
    const body = { name: name.trim(), description: description.trim() || null }
    const patch = changes(category, body)
    run(async () => {
      const result = category.id ? Object.keys(patch).length ? await tenant.patch(`menu/categories/${category.id}`, patch) : { data: category } : await tenant.post('menu/categories', body)
      saveCategoryIcon(scope, result.data.id, icon)
    })
  }
  return <CatalogModal title={category.id ? 'Edit Category' : 'Add New Category'} description="Organize your baked goods under a new category." onClose={onClose} busy={busy}><form onSubmit={save} className="catalog-form"><ErrorMessage error={error} /><fieldset disabled={busy} className="catalog-form"><CatalogField label="Category Name" name="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} errors={error?.fieldErrors} /><fieldset className="category-icon-options"><legend>Category Icon</legend><div className="category-icon-grid">{categoryIcons.map((item) => <button key={item.id} type="button" aria-label={`${item.name} icon`} aria-pressed={icon === item.id} onClick={() => setIcon(item.id)}><DesignIcon file={item.file} /></button>)}</div><p>Icon preference is saved on this device.</p></fieldset><details className="catalog-form-advanced"><summary>More category options</summary><div><Field label="Description" name="description" value={description} onChange={(event) => setDescription(event.target.value)} errors={error?.fieldErrors} />{category.id && <button type="button" className={buttonClass} onClick={() => { if (category.isActive) { if (window.confirm(`Switch off ${category.name}? Products in this category will no longer appear to customers.`)) run(() => tenant.delete(`menu/categories/${category.id}`)) } else run(() => tenant.patch(`menu/categories/${category.id}`, { isActive: true })) }}>{category.isActive ? 'Switch off' : 'Switch on'}</button>}</div></details><div className="catalog-form-footer"><button type="button" className="catalog-button" onClick={onClose}>Cancel</button><button className="catalog-button catalog-primary">{busy ? 'Saving…' : category.id ? 'Save Category' : 'Add Category'}</button></div></fieldset></form></CatalogModal>
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
  const [inStock, setInStock] = useState(product.isActive !== false)
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState('')
  const [hasSizes, setHasSizes] = useState(product.hasSizes || false)
  const [sizes, setSizes] = useState(product.sizes?.map((size) => ({ ...size, price: String(size.price / 100) })) || [])
  const [addonSetIds, setAddonSetIds] = useState(product.addonSets?.filter((set) => set.isActive !== false).map((set) => set.id) || [])
  const [unavailable, setUnavailable] = useState(product.branches?.filter((branch) => !branch.available).map((branch) => branch.id) || [])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const addonSets = useRemote(() => current.id ? tenant.list('menu/addon-sets') : Promise.resolve(null), [current.id])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  const run = async (action) => {
    setBusy(true); setError(null); setNotice('')
    try { const result = await action(); if (result?.data) setCurrent(result.data); await onSaved(); setNotice('Saved.') } catch (err) { setError(err) } finally { setBusy(false) }
  }
  const sizeBody = () => hasSizes ? { sizes: sizes.map((size) => ({ ...(size.id ? { id: size.id } : {}), name: size.name.trim(), price: toMinor(size.price) })) } : { sizes: [], price: toMinor(price) }
  const saveDetails = async (event) => {
    event.preventDefault()
    setBusy(true); setError(null); setNotice('')
    try {
      let result
      if (!current.id) {
        result = await tenant.post('menu/products', { name: name.trim(), description: description.trim() || null, categoryId, ...(hasSizes ? sizeBody() : { price: toMinor(price) }) })
        // Keep the created ID if a subsequent photo or availability request fails.
        setCurrent(result.data)
        setSizes(result.data.sizes?.map((size) => ({ ...size, price: String(size.price / 100) })) || [])
      } else {
        const body = { name: name.trim(), description: description.trim() || null, categoryId, ...(!current.hasSizes ? { price: toMinor(price) } : {}) }
        const patch = changes({ ...current, categoryId: current.category?.id }, body)
        result = Object.keys(patch).length ? await tenant.patch(`menu/products/${current.id}`, patch) : { data: current }
      }
      let saved = result.data
      if (photo) { saved = (await tenant.post(`menu/products/${saved.id}/photo`, photo)).data; setCurrent(saved); setPhoto(null); setPreview('') }
      if (saved.isActive !== inStock) { saved = inStock ? (await tenant.patch(`menu/products/${saved.id}`, { isActive: true })).data : (await tenant.delete(`menu/products/${saved.id}`)).data }
      setCurrent(saved)
      await onSaved()
      onClose()
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  const toggle = (setter, id) => setter((previous) => previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id])
  const sizeFields = <div className="flex flex-col gap-3"><label className="text-sm"><input type="checkbox" checked={hasSizes} onChange={(event) => { setHasSizes(event.target.checked); if (event.target.checked && !sizes.length) setSizes([{ name: '', price: '' }]) }} /> Has sizes</label>{hasSizes ? <>{sizes.map((size, index) => <div key={size.id || index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"><Field label="Size" name={`sizes.${index}.name`} value={size.name} required errors={error?.fieldErrors} onChange={(event) => setSizes((previous) => previous.map((row, i) => i === index ? { ...row, name: event.target.value } : row))} /><Field label={`Price (${symbol})`} name={`sizes.${index}.price`} type="number" min="0.01" step="0.01" value={size.price} required errors={error?.fieldErrors} onChange={(event) => setSizes((previous) => previous.map((row, i) => i === index ? { ...row, price: event.target.value } : row))} /><button type="button" className={buttonClass} disabled={sizes.length === 1} aria-label={`Remove size ${index + 1}`} onClick={() => setSizes((previous) => previous.filter((_, i) => i !== index))}>×</button></div>)}<button type="button" className={buttonClass} onClick={() => setSizes((previous) => [...previous, { name: '', price: '' }])}>Add size</button></> : current.id ? <Field label={`Price (${symbol})`} name="price" type="number" min="0.01" step="0.01" value={price} required onChange={(event) => setPrice(event.target.value)} errors={error?.fieldErrors} /> : null}</div>
  return <CatalogModal title={current.id ? 'Edit Item' : 'Add New Item'} description={current.id ? 'Edit this item in your category.' : 'Add an item in this category.'} wide onClose={onClose} busy={busy}><ErrorMessage error={error} />{notice && <p role="status" className="mb-3 text-sm text-green-700">{notice}</p>}<fieldset disabled={busy} className="catalog-form">
    <form id="product-details" onSubmit={saveDetails} className="catalog-form">
      <div className="catalog-form-fields"><CatalogField label="Item Name" name="name" value={name} required maxLength={150} onChange={(event) => setName(event.target.value)} errors={error?.fieldErrors} /><div className="catalog-field-row">{!hasSizes ? <CatalogField label={`Price (${symbol})`} name="price" type="number" min="0.01" step="0.01" required value={price} onChange={(event) => setPrice(event.target.value)} errors={error?.fieldErrors} /> : <CatalogField label="Price" value="Prices set by size" readOnly />}<CatalogField label="Time to prepare" value={current.prepTimeMinutes != null ? `${current.prepTimeMinutes} min` : 'Branch default'} readOnly title="Preparation time is managed in branch settings." /></div><CatalogField label="Description" name="description" value={description} onChange={(event) => setDescription(event.target.value)} errors={error?.fieldErrors} /></div>
      <div className="product-photo-section"><div><label className="product-photo-upload">{preview || current.photo?.url ? <img src={preview || current.photo.url} alt={name || 'Product photo preview'} /> : <><DesignIcon file="f9d03" /><span>Upload image<small>PNG or JPG</small></span></>}<input type="file" aria-label="Upload product image" accept="image/png,image/jpeg,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; try { await validatePhoto(file); setPhoto(file); setPreview(URL.createObjectURL(file)); setError(null) } catch (err) { setError(err) } }} /></label>{photo && <button type="button" className="mt-2 text-xs text-muted" onClick={() => { setPhoto(null); setPreview('') }}>Discard new photo</button>}{current.photo && <button type="button" className="mt-2 text-xs text-muted" onClick={() => { if (window.confirm('Remove this photo?')) run(() => tenant.delete(`menu/products/${current.id}/photo`)) }}>Remove photo</button>}</div><div className="product-photo-guidelines"><h3>Guidelines:</h3><ol><li>Product image must have a transparent background</li><li>Only the product must be visible in the image</li></ol><h3 className="mt-2.5">What to avoid:</h3><div className="product-photo-examples">{['775e1', '7df29', '8df99'].map((file) => <div key={file} className="product-photo-example"><img src={`/figma/catalog/${file}.png`} alt="Example of an unsuitable product image" /><DesignIcon file="c5858" /></div>)}</div></div></div>
      <div className="catalog-asset-divider"><DesignIcon file="269d1" /></div><div className="product-availability"><div><h3>In Stock Availability</h3><p>Allow customers to order this product immediately</p></div><SettingsToggle checked={inStock} ariaLabel="In Stock Availability" onChange={setInStock} /></div>
      {!current.id && <details className="catalog-form-advanced"><summary>Sizes & category</summary><div><Field label="Category" name="categoryId" errors={error?.fieldErrors}><select value={categoryId} required onChange={(event) => setCategoryId(event.target.value)} className={buttonClass}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>{sizeFields}</div></details>}
    </form>
    {current.id && <details className="catalog-form-advanced"><summary>Sizes, add-ons & branches</summary><div><Field label="Category" name="categoryId" errors={error?.fieldErrors}><select form="product-details" value={categoryId} required onChange={(event) => setCategoryId(event.target.value)} className={buttonClass}>{!categories.some((category) => category.id === categoryId) && <option value={categoryId}>{current.category?.name}</option>}{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
      <form onSubmit={(event) => { event.preventDefault(); run(async () => { const result = await tenant.put(`menu/products/${current.id}/sizes`, sizeBody()); setSizes(result.data.sizes?.map((size) => ({ ...size, price: String(size.price / 100) })) || []); setHasSizes(result.data.hasSizes); if (!result.data.hasSizes) setPrice(String(result.data.price / 100)); return result }) }} className="flex flex-col gap-3"><h3 className="font-semibold">Sizes and pricing</h3>{sizeFields}<button className={buttonClass}>Save sizes</button></form>
      <section className="flex flex-col gap-3 border-t border-gray-100 pt-4"><h3 className="font-semibold">Add-on groups</h3><ErrorMessage error={addonSets.error} />{addonSets.data?.data?.map((set) => <label key={set.id} className="text-sm"><input type="checkbox" checked={addonSetIds.includes(set.id)} onChange={() => toggle(setAddonSetIds, set.id)} /> {set.name}</label>)}<button type="button" className={buttonClass} disabled={!addonSets.data} onClick={() => run(() => tenant.put(`menu/products/${current.id}/addon-sets`, { addonSetIds }))}>Save add-on groups</button></section>
      <section className="flex flex-col gap-3 border-t border-gray-100 pt-4"><h3 className="font-semibold">Branches selling this item</h3>{current.branches?.map((branch) => <label key={branch.id} className="text-sm"><input type="checkbox" checked={!unavailable.includes(branch.id)} onChange={() => toggle(setUnavailable, branch.id)} /> {branch.name}</label>)}<button type="button" className={buttonClass} onClick={() => run(() => tenant.put(`menu/products/${current.id}/branches`, { unavailableBranchIds: unavailable }))}>Save branch availability</button></section>
    </div></details>}
    <div className="catalog-form-footer"><button type="button" className="catalog-button" onClick={onClose}>Cancel</button><button form="product-details" className="catalog-button catalog-primary">{busy ? 'Saving…' : current.id ? 'Save Item' : 'Add Item'}</button></div>
  </fieldset></CatalogModal>
}
