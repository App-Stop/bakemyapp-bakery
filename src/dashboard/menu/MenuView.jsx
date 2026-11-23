import { useState } from 'react'
import { can, money, tenant } from '../../lib/tenant'
import { useTenant } from '../../lib/TenantContext'
import { useRemote } from '../../lib/useRemote'
import { buttonClass, primaryClass, cardClass, ErrorMessage, Pagination } from '../shared/ApiUI'
import { CategoryForm, ProductEditor } from './MenuForms'
import { AddonSets } from './AddonSets'

export function MenuView() {
  const { user, branding } = useTenant()
  const editable = can(user, 'menu:edit')
  const [section, setSection] = useState('products')
  const [status, setStatus] = useState('active')
  const [selectedId, setSelectedId] = useState('')
  const [q, setQ] = useState('')
  const [branchId, setBranchId] = useState('')
  const [page, setPage] = useState(1)
  const [categoryEditor, setCategoryEditor] = useState(null)
  const [productEditor, setProductEditor] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const categories = useRemote(() => tenant.list('menu/categories', { status }), [status])
  const branches = useRemote(() => can(user, 'branches:view') ? tenant.list('branches') : Promise.resolve(null), [user.id])
  const active = categories.data?.data?.find((item) => item.id === selectedId) || categories.data?.data?.[0]
  const products = useRemote(() => active ? tenant.list('menu/products', { categoryId: active.id, q, branchId, status, page, limit: 10 }) : Promise.resolve({ data: [] }), [active?.id, q, branchId, status, page])
  const refresh = async () => { await Promise.all([categories.refresh(), products.refresh()]) }
  const mutate = async (action) => {
    setBusy(true); setError(null)
    try { await action(); await refresh() } catch (err) { setError(err) } finally { setBusy(false) }
  }
  const editCategory = (category) => mutate(async () => setCategoryEditor((await tenant.get(`menu/categories/${category.id}`)).data))
  const editProduct = (product) => mutate(async () => setProductEditor((await tenant.get(`menu/products/${product.id}`)).data))
  const reorder = (collection, fromId, toId, path, extra = {}) => {
    const ids = collection.map((item) => item.id)
    const from = ids.indexOf(fromId); const to = ids.indexOf(toId)
    if (from < 0 || to < 0 || from === to) return
    ids.splice(to, 0, ids.splice(from, 1)[0])
    mutate(() => tenant.put(path, { ...extra, ids }))
  }
  const switchOff = (path, name) => { if (window.confirm(`Switch off ${name}? Its history will be kept.`)) mutate(() => tenant.delete(path)) }
  return <div className="mx-auto flex max-w-[1360px] flex-col gap-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-[28px] font-semibold">Menu Catalog</h1><p className="text-sm text-muted">Manage products, prices, categories and extras.</p></div><div className="flex gap-2"><button className={section === 'products' ? primaryClass : buttonClass} onClick={() => setSection('products')}>Products</button><button className={section === 'addons' ? primaryClass : buttonClass} onClick={() => setSection('addons')}>Add-on groups</button></div></div>
    <div className="flex flex-wrap gap-2">{['active', 'inactive', 'all'].map((tab) => <button key={tab} className={status === tab ? primaryClass : buttonClass} onClick={() => { setStatus(tab); setPage(1) }}>{tab === 'active' ? 'Active' : tab === 'inactive' ? 'Inactive' : 'All'}</button>)}</div>
    {section === 'addons' ? <AddonSets status={status} editable={editable} symbol={branding?.currencySymbol} /> : <>
      <ErrorMessage error={error || categories.error || products.error || branches.error} />
      <div className="grid items-start gap-5 md:grid-cols-[240px_1fr]">
        <aside className={`${cardClass} flex flex-col gap-3`}><h2 className="font-semibold">Categories</h2>{categories.loading && <p role="status">Loading…</p>}{categories.data?.data?.map((category) => <div key={category.id} className="flex items-center gap-1" draggable={editable && !busy} onDragStart={(event) => event.dataTransfer.setData('category', category.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); reorder(categories.data.data, event.dataTransfer.getData('category'), category.id, 'menu/categories/order') }}><button className={`${active?.id === category.id ? '!bg-brand-light !text-brand' : ''} ${buttonClass} min-w-0 flex-1 !rounded-xl text-left`} onClick={() => { setSelectedId(category.id); setPage(1) }}>{category.name} <span className="text-xs">({category.productCount})</span></button>{editable && <button aria-label={`Edit ${category.name}`} className="px-2" onClick={() => editCategory(category)}>✎</button>}</div>)}{editable && <button className={buttonClass} onClick={() => setCategoryEditor({})}>Add Category</button>}{editable && <p className="text-xs text-muted">Drag categories to reorder.</p>}</aside>
        <section className={`${cardClass} flex min-w-0 flex-col gap-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{active?.name || 'No categories yet'}</h2>{editable && active?.isActive && <button className={primaryClass} onClick={() => setProductEditor({ category: active })}>Add New Item</button>}</div>
          <div className="flex flex-wrap gap-3"><input aria-label="Search products" value={q} onChange={(event) => { setQ(event.target.value); setPage(1) }} placeholder="Search products…" className="min-w-0 flex-1 rounded-full border border-[#e8e8e8] px-4 py-2" />{can(user, 'branches:view') && <select aria-label="Filter products by branch" className={buttonClass} value={branchId} onChange={(event) => { setBranchId(event.target.value); setPage(1) }}><option value="">All branches</option>{branches.data?.data?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>}<button className={buttonClass} onClick={refresh}>Refresh</button></div>
          {products.loading && <p role="status">Loading products…</p>}
          {!products.loading && !products.error && !products.data?.data?.length && <p className="py-8 text-center text-muted">No products found.</p>}
          {products.data?.data?.map((product, index, rows) => <article key={product.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#f0ece9] p-4"><div className="flex min-w-0 items-center gap-3">{product.photo?.url && <img src={product.photo.url} alt="" className="size-14 rounded-xl object-cover" />}<div><h3 className="font-semibold">{product.name}</h3><p className="text-sm text-muted">{product.description}</p><p className="text-sm font-medium">{product.hasSizes ? 'From ' : ''}{money(product.priceFrom ?? product.price, branding?.currencySymbol)}</p></div></div><div className="flex flex-wrap items-center gap-2"><span className={`text-xs ${product.isActive ? 'text-green-700' : 'text-muted'}`}>{product.isActive ? 'Active' : 'Switched off'}</span>{editable && <><button className={buttonClass} disabled={busy} onClick={() => editProduct(product)}>Edit</button>{product.isActive ? <button className={buttonClass} disabled={busy} onClick={() => switchOff(`menu/products/${product.id}`, product.name)}>Switch off</button> : <button className={buttonClass} disabled={busy} onClick={() => mutate(() => tenant.patch(`menu/products/${product.id}`, { isActive: true }))}>Switch on</button>}{!q && !branchId && page === 1 && <button className={buttonClass} disabled={busy || index === 0} aria-label={`Move ${product.name} up`} onClick={() => reorder(rows, product.id, rows[index - 1].id, 'menu/products/order', { categoryId: active.id })}>↑</button>}</>}</div></article>)}
          <Pagination pagination={products.data?.pagination} page={page} onChange={setPage} disabled={products.loading} />
        </section>
      </div>
    </>}
    {categoryEditor && <CategoryForm key={categoryEditor.id || 'new'} category={categoryEditor} onClose={() => setCategoryEditor(null)} onSaved={refresh} />}
    {productEditor && <ProductEditor key={productEditor.id || 'new'} product={productEditor} categories={categories.data?.data?.filter((category) => category.isActive) || []} symbol={branding?.currencySymbol} onClose={() => setProductEditor(null)} onSaved={refresh} />}
  </div>
}
