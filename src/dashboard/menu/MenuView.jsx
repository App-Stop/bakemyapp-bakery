import { useState } from 'react'
import { can, money, tenant } from '../../lib/tenant'
import { useTenant } from '../../lib/TenantContext'
import { useRemote } from '../../lib/useRemote'
import { buttonClass, ErrorMessage } from '../shared/ApiUI'
import { CatalogPagination, CatalogSearch, DesignIcon } from '../shared/CatalogUI'
import { SettingsToggle } from '../settings/SettingsToggle'
import { CategoryForm, ProductEditor } from './MenuForms'
import { AddonSets } from './AddonSets'
import { categoryIcon } from './categoryIcons'

export function MenuView() {
  const { user, branding } = useTenant()
  const editable = can(user, 'menu:edit')
  const scope = user.tenant?.id || user.id
  const [section, setSection] = useState('products')
  const [status, setStatus] = useState('all')
  const [selectedId, setSelectedId] = useState('')
  const [q, setQ] = useState('')
  const [branchId, setBranchId] = useState('')
  const [page, setPage] = useState(1)
  const [categoryEditor, setCategoryEditor] = useState(null)
  const [productEditor, setProductEditor] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const categories = useRemote(() => tenant.list('menu/categories', { status: 'all' }), [])
  const branches = useRemote(() => can(user, 'branches:view') ? tenant.list('branches') : Promise.resolve(null), [user.id])
  const active = categories.data?.data?.find((item) => item.id === selectedId) || categories.data?.data?.find((item) => item.isActive) || categories.data?.data?.[0]
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
  const rows = products.data?.data || []
  const icon = active && categoryIcon(active, scope)
  const headingIcon = icon?.id === 'croissant' ? 'ed777' : icon?.id === 'donut' ? '9dfde' : icon?.file
  const addItem = () => setProductEditor({ category: active })
  return <div className="catalog-page menu-page">
    <header className="catalog-header"><div><h1>Menu Catalog</h1><p>Edit your products, availability, prices, and categories in real-time.</p></div><CatalogSearch label="Search products" value={q} placeholder="Search products..." onChange={(value) => { setQ(value); setPage(1); setSection('products') }} /></header>
    <ErrorMessage error={error || categories.error || products.error || branches.error} />
    <div className="menu-layout">
      <aside className="menu-categories"><h2>Categories</h2>{categories.loading && !categories.data && <p role="status">Loading categories…</p>}
        <div className="menu-category-list">{categories.data?.data?.map((category) => <div key={category.id} className={`menu-category ${active?.id === category.id ? 'is-selected' : ''}`} draggable={editable && !busy} onDragStart={(event) => event.dataTransfer.setData('category', category.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); reorder(categories.data.data, event.dataTransfer.getData('category'), category.id, 'menu/categories/order') }}><DesignIcon file="6d1a9" /><button aria-pressed={active?.id === category.id} onClick={() => { setSelectedId(category.id); setPage(1); setSection('products') }}>{category.name}{!category.isActive && <small> · Off</small>}<span>{category.productCount}</span></button></div>)}</div>
        {editable && <button className="catalog-button menu-add-category" onClick={() => setCategoryEditor({})}><DesignIcon file="6712c" />Add Category</button>}
      </aside>
      {section === 'addons' ? <section className="menu-products"><div className="menu-category-heading"><h2>Add-on groups</h2><button className="catalog-button" onClick={() => setSection('products')}>Back to products</button></div><AddonSets status={status} editable={editable} symbol={branding?.currencySymbol} /></section> : <section className="menu-products" aria-busy={products.loading}>
        <div className="menu-category-heading"><div className="menu-category-title">{icon && <span className="menu-category-icon"><DesignIcon file={headingIcon} /></span>}<div><h2>{active?.name || 'Your menu'}</h2><p>{active ? `${products.data?.pagination?.totalItems ?? active.productCount} ${(products.data?.pagination?.totalItems ?? active.productCount) === 1 ? 'item' : 'items'} in this category` : 'Create a category to get started'}</p></div></div><div className="menu-category-actions">{editable && active && <button className="catalog-button" disabled={busy} onClick={() => editCategory(active)}><DesignIcon file="22311" />Edit Category</button>}{editable && active?.isActive && rows.length > 0 && <button className="catalog-button catalog-primary" onClick={addItem}><DesignIcon file="8a223" />Add Item</button>}</div></div>
        {products.loading && !products.data && <p className="catalog-empty-message" role="status">Loading products…</p>}
        {!products.loading && !products.error && !rows.length && <div className="menu-empty"><span className="menu-empty-icon"><DesignIcon file="56d88" /></span><h3>{q || branchId || status !== 'all' ? 'No matching items' : 'No Items'}</h3><p>{q || branchId || status !== 'all' ? 'Try another search or filter.' : 'Start by adding a product'}</p>{editable && active?.isActive && <button className="catalog-button catalog-primary" onClick={addItem}><DesignIcon file="8a223" />Add Item</button>}{editable && !active && <button className="catalog-button catalog-primary" onClick={() => setCategoryEditor({})}>Add Category</button>}</div>}
        <div className="menu-product-list">{rows.map((product) => <article key={product.id} className="menu-product"><div className="menu-product-photo">{product.photo?.url ? <img src={product.photo.url} alt={product.name} /> : <DesignIcon file="f9d03" />}</div><div className="menu-product-info"><h3>{product.name}</h3><p>{product.prepTimeMinutes != null && <><DesignIcon file="f1b7e" />{product.prepTimeMinutes} min <DesignIcon file="76143" /></>}{product.description}</p></div><span className="menu-product-price">{product.hasSizes ? 'From ' : ''}{money(product.priceFrom ?? product.price, branding?.currencySymbol)}</span><div className="menu-product-stock"><span>{product.isActive ? 'In Stock' : 'Sold Out'}</span><SettingsToggle checked={product.isActive} ariaLabel={`In stock: ${product.name}`} disabled={!editable || busy} onChange={(checked) => mutate(() => checked ? tenant.patch(`menu/products/${product.id}`, { isActive: true }) : tenant.delete(`menu/products/${product.id}`))} /></div>{editable && <button className="menu-product-edit" disabled={busy} onClick={() => editProduct(product)}>Edit</button>}</article>)}</div>
        <CatalogPagination pagination={products.data?.pagination?.totalPages > 1 ? products.data.pagination : null} count={rows.length} page={page} onChange={setPage} disabled={products.loading} />
      </section>}
    </div>
    <details className="catalog-tools"><summary>Menu tools</summary><div className="catalog-tools-content"><button className={buttonClass} onClick={() => setSection(section === 'addons' ? 'products' : 'addons')}>{section === 'addons' ? 'Products' : 'Add-on groups'}</button><label className="text-sm">Product status<select aria-label="Product status" className={buttonClass} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>{can(user, 'branches:view') && <select aria-label="Filter products by branch" className={buttonClass} value={branchId} onChange={(event) => { setBranchId(event.target.value); setPage(1) }}><option value="">All branches</option>{branches.data?.data?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>}<button className={buttonClass} onClick={refresh}>Refresh</button>{editable && <><p className="text-xs text-muted">Drag categories to reorder. Use the arrows below to reorder products.</p>{!q && !branchId && page === 1 && rows.map((product, index) => <button key={product.id} className={buttonClass} disabled={busy || index === 0} aria-label={`Move ${product.name} up`} onClick={() => reorder(rows, product.id, rows[index - 1].id, 'menu/products/order', { categoryId: active.id })}>↑ {product.name}</button>)}</>}</div></details>
    {categoryEditor && <CategoryForm key={categoryEditor.id || 'new'} category={categoryEditor} onClose={() => setCategoryEditor(null)} onSaved={refresh} />}
    {productEditor && <ProductEditor key={productEditor.id || 'new'} product={productEditor} categories={categories.data?.data?.filter((category) => category.isActive) || []} symbol={branding?.currencySymbol} onClose={() => setProductEditor(null)} onSaved={refresh} />}
  </div>
}
