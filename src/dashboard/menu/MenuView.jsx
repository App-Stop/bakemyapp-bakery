import { HugeiconsIcon } from '@hugeicons/react'
import { MenuRestaurantIcon, ArrowUp02Icon, ArrowDown02Icon } from '@hugeicons/core-free-icons'
import { PageOptions, RefreshButton } from '../shared/PageOptions'
import { Skeleton } from '../shared/Skeleton'
import { useState } from 'react'
import { can, money, tenant } from '../../lib/tenant'
import { useTenant } from '../../lib/TenantContext'
import { useRemote } from '../../lib/useRemote'
import { ErrorMessage } from '../shared/ApiUI'
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
  const [refreshing, setRefreshing] = useState(false)
  const [addonRefresh, setAddonRefresh] = useState(0)
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
  const refresh = async () => {
    setRefreshing(true)
    try { setAddonRefresh((value) => value + 1); await Promise.all([categories.refresh(), products.refresh(), branches.refresh()]) } finally { setRefreshing(false) }
  }
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
  const filterCount = (section === 'addons' ? [status !== 'all'] : [q, branchId, status !== 'all']).filter(Boolean).length
  const canReorder = !q && !branchId && status === 'all' && page === 1
  const clearFilters = () => { if (section === 'products') { setQ(''); setBranchId('') } setStatus('all'); setPage(1) }
  const addItem = () => setProductEditor({ category: active })
  return <div className="catalog-page menu-page">
    <header className="catalog-header"><div><h1>Menu Catalog</h1><p>Edit your products, availability, prices, and categories in real-time.</p></div><CatalogSearch label="Search products" value={q} placeholder="Search products..." onChange={(value) => { setQ(value); setPage(1); setSection('products') }} /></header>
    <ErrorMessage error={error || categories.error || products.error || branches.error} />
    <div className="menu-layout">
      <aside className="menu-categories"><h2>Categories</h2>{categories.loading && !categories.data && <Skeleton variant="list" label="Loading menu categories" rows={5} />}
        <div className="menu-category-list">{categories.data?.data?.map((category) => <div key={category.id} className={`menu-category ${active?.id === category.id ? 'is-selected' : ''}`} draggable={editable && !busy} onDragStart={(event) => event.dataTransfer.setData('category', category.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); reorder(categories.data.data, event.dataTransfer.getData('category'), category.id, 'menu/categories/order') }}><DesignIcon file="6d1a9" /><button aria-pressed={active?.id === category.id} onClick={() => { setSelectedId(category.id); setPage(1); setSection('products') }}>{category.name}{!category.isActive && <small> · Off</small>}<span>{category.productCount}</span></button></div>)}</div>
        {editable && <button className="catalog-button menu-add-category" onClick={() => setCategoryEditor({})}><DesignIcon file="6712c" />Add Category</button>}
      </aside>
      {section === 'addons' ? <section className="menu-products"><div className="menu-category-heading"><h2>Add-on groups</h2><button className="catalog-button" onClick={() => setSection('products')}>Back to products</button></div><AddonSets refreshKey={addonRefresh} status={status} editable={editable} symbol={branding?.currencySymbol} /></section> : <section className="menu-products" aria-busy={products.loading}>
        <div className="menu-category-heading"><div className="menu-category-title">{icon && <span className="menu-category-icon"><DesignIcon file={headingIcon} /></span>}<div><h2>{active?.name || 'Your menu'}</h2><p>{active ? `${products.data?.pagination?.totalItems ?? active.productCount} ${(products.data?.pagination?.totalItems ?? active.productCount) === 1 ? 'item' : 'items'} in this category` : 'Create a category to get started'}</p></div></div><div className="menu-category-actions">{editable && active && <button className="catalog-button" disabled={busy} onClick={() => editCategory(active)}><DesignIcon file="22311" />Edit Category</button>}{editable && active?.isActive && rows.length > 0 && <button className="catalog-button catalog-primary" onClick={addItem}><DesignIcon file="8a223" />Add Item</button>}</div></div>
        {((categories.loading && !categories.data) || (products.loading && !products.data)) && <Skeleton variant="products" label="Loading menu products" rows={5} />}
        {!categories.loading && !products.loading && !products.error && !rows.length && <div className="menu-empty"><span className="menu-empty-icon"><DesignIcon file="56d88" /></span><h3>{q || branchId || status !== 'all' ? 'No matching items' : 'No Items'}</h3><p>{q || branchId || status !== 'all' ? 'Try another search or filter.' : 'Start by adding a product'}</p>{editable && active?.isActive && <button className="catalog-button catalog-primary" onClick={addItem}><DesignIcon file="8a223" />Add Item</button>}{editable && !active && <button className="catalog-button catalog-primary" onClick={() => setCategoryEditor({})}>Add Category</button>}</div>}
        <div className="menu-product-list">{rows.map((product) => <article key={product.id} className="menu-product"><div className="menu-product-photo">{product.photo?.url ? <img src={product.photo.url} alt={product.name} /> : <DesignIcon file="f9d03" />}</div><div className="menu-product-info"><h3>{product.name}</h3><p>{product.prepTimeMinutes != null && <><DesignIcon file="f1b7e" />{product.prepTimeMinutes} min <DesignIcon file="76143" /></>}{product.description}</p></div><span className="menu-product-price">{product.hasSizes ? 'From ' : ''}{money(product.priceFrom ?? product.price, branding?.currencySymbol)}</span><div className="menu-product-stock"><span>{product.isActive ? 'In Stock' : 'Sold Out'}</span><SettingsToggle checked={product.isActive} ariaLabel={`In stock: ${product.name}`} disabled={!editable || busy} onChange={(checked) => mutate(() => checked ? tenant.patch(`menu/products/${product.id}`, { isActive: true }) : tenant.delete(`menu/products/${product.id}`))} /></div>{editable && <button className="menu-product-edit" disabled={busy} onClick={() => editProduct(product)}>Edit</button>}</article>)}</div>
        <CatalogPagination pagination={products.data?.pagination?.totalPages > 1 ? products.data.pagination : null} count={rows.length} page={page} onChange={setPage} disabled={products.loading} />
      </section>}
    </div>
    <PageOptions title="Menu controls" description="Filter your menu, manage add-ons and arrange the display order." icon={MenuRestaurantIcon} toggleLabel="menu options" badge={filterCount ? filterCount + (filterCount === 1 ? ' filter applied' : ' filters applied') : null} actions={<RefreshButton label="Refresh menu" refreshing={refreshing} disabled={busy} onClick={refresh} />}>
      <section className="page-options-group">
        <h3>What would you like to manage?</h3>
        <div className="page-options-switcher" role="group" aria-label="Menu content">
          <button type="button" aria-pressed={section === 'products'} onClick={() => setSection('products')}>Products</button>
          <button type="button" aria-pressed={section === 'addons'} onClick={() => setSection('addons')}>Add-on groups</button>
        </div>
        <p className="page-options-hint">{section === 'addons' ? 'Add-on groups are extras, such as toppings, that you can reuse across products.' : 'Choose a category above to manage its products.'}</p>
      </section>
      <section className="page-options-group">
        <div className="page-options-row"><h3>{section === 'addons' ? 'Filter add-on groups' : 'Filter products'}</h3>{filterCount > 0 && <button type="button" className="page-options-button" aria-label="Clear menu filters" onClick={clearFilters}>Clear filters</button>}</div>
        <div className="page-options-fields">
          <label>{section === 'addons' ? 'Group status' : 'Product status'}<select aria-label={section === 'addons' ? 'Add-on group status' : 'Product status'} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="all">All statuses</option><option value="active">Active only</option><option value="inactive">Inactive only</option></select></label>
          {section === 'products' && can(user, 'branches:view') && <label>Available at branch<select aria-label="Filter products by branch" value={branchId} onChange={(event) => { setBranchId(event.target.value); setPage(1) }}><option value="">All branches</option>{branches.data?.data?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>}
        </div>
      </section>
      {editable && section === 'products' && <section className="page-options-group">
        <h3>Display order</h3><p className="page-options-hint">Drag categories in the category list to change their order. Use the arrows here to move a product up or down in {active?.name || 'its category'}.</p>
        {!canReorder ? <div className="page-options-row"><p className="page-options-hint">Show all products on page 1 to change their display order.</p><button type="button" className="page-options-button" onClick={clearFilters}>Show all products</button></div> : rows.length ? <ol className="page-options-order" aria-label="Product display order">{rows.map((product, index) => <li key={product.id}>
          <span className="page-options-position">{index + 1}</span><span className="page-options-product-name" title={product.name}>{product.name}</span>
          <div className="page-options-actions"><button type="button" className="page-options-button" disabled={busy || products.loading || index === 0} aria-label={'Move ' + product.name + ' up'} title="Move up" onClick={() => reorder(rows, product.id, rows[index - 1].id, 'menu/products/order', { categoryId: active.id })}><HugeiconsIcon icon={ArrowUp02Icon} size={16} aria-hidden="true" /></button><button type="button" className="page-options-button" disabled={busy || products.loading || index === rows.length - 1} aria-label={'Move ' + product.name + ' down'} title="Move down" onClick={() => reorder(rows, product.id, rows[index + 1].id, 'menu/products/order', { categoryId: active.id })}><HugeiconsIcon icon={ArrowDown02Icon} size={16} aria-hidden="true" /></button></div>
        </li>)}</ol> : <p className="page-options-hint">Products will appear here after you add them to a category.</p>}
      </section>}
    </PageOptions>
    {categoryEditor && <CategoryForm key={categoryEditor.id || 'new'} category={categoryEditor} onClose={() => setCategoryEditor(null)} onSaved={refresh} />}
    {productEditor && <ProductEditor key={productEditor.id || 'new'} product={productEditor} categories={categories.data?.data?.filter((category) => category.isActive) || []} symbol={branding?.currencySymbol} onClose={() => setProductEditor(null)} onSaved={refresh} />}
  </div>
}
