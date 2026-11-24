import { Skeleton } from '../shared/Skeleton'
import { useState } from 'react'
import { can, tenant, money, changes, dateTime } from '../../lib/tenant'
import { useTenant } from '../../lib/TenantContext'
import { useRemote } from '../../lib/useRemote'
import { ErrorMessage, Field, buttonClass, primaryClass, cardClass } from '../shared/ApiUI'
import { CatalogModal, CatalogPagination } from '../shared/CatalogUI'
import { SettingsToggle } from '../settings/SettingsToggle'
import { promoForm, promoBody, quantityBody, localDateTime } from './pricingHelpers'
import '../shared/modules.css'

export function PricingView({ initialTab = 'rules' }) {
  const { user } = useTenant()
  const owner = user.role === 'tenant_owner' && can(user, 'payments:manage')
  const tabs = [...(owner ? [['rules', 'Pricing Rules'], ['promos', 'Promo Codes']] : []), ...(can(user, 'menu:view') ? [['quantity', 'Quantity Discounts']] : [])]
  const [tab, setTab] = useState(initialTab)
  const active = tabs.some(([id]) => id === tab) ? tab : tabs[0]?.[0]
  if (!active) return <p>You do not have permission to view pricing.</p>
  return <div className="mx-auto flex max-w-[1200px] flex-col gap-6"><header><h1 className="text-[28px] font-semibold">Pricing & Discounts</h1><p className="text-sm text-muted">Set pricing rules and offers for your bakery.</p></header><div role="tablist" aria-label="Pricing sections" className="catalog-tabs overflow-x-auto">{tabs.map(([id, label]) => <button role="tab" aria-selected={active === id} key={id} onClick={() => setTab(id)}>{label}</button>)}</div><div role="tabpanel">{active === 'rules' ? <PricingRules /> : active === 'promos' ? <PromoCodes /> : <QuantityDiscounts />}</div></div>
}
function PricingRules() {
  const remote = useRemote(() => tenant.get('pricing'), [])
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  return <section className={`${cardClass} module-section`}><h2>Pricing Rules</h2><ErrorMessage error={remote.error || error} />{saved && <p role="status" className="catalog-notice">Pricing rules saved.</p>}{remote.loading ? <Skeleton label="Loading pricing rules" fields={4} /> : remote.data ? <RulesForm key={JSON.stringify(remote.data)} data={remote.data.data} onSaved={async () => { setSaved(true); await remote.refresh() }} error={error} onError={setError} /> : <button className={buttonClass} onClick={remote.refresh}>Retry</button>}</section>
}
function RulesForm({ data, onSaved, onError, error }) {
  const [draft, setDraft] = useState(data)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const save = async (event) => {
    event.preventDefault(); setBusy(true); onError(null); setNotice('')
    try { const patch = changes(data, { taxRate: Number(draft.taxRate), pricesIncludeTax: draft.pricesIncludeTax, discountsStack: draft.discountsStack, guestCheckoutEnabled: draft.guestCheckoutEnabled }); if (Object.keys(patch).length) { await tenant.patch('pricing', patch); await onSaved() } else setNotice('No changes to save.') } catch (error) { onError(error) } finally { setBusy(false) }
  }
  return <form onSubmit={save}><fieldset disabled={busy} className="module-section"><Field label="Tax rate (%)" name="taxRate" errors={error?.fieldErrors} type="number" min="0" max="100" step="any" required value={draft.taxRate} onChange={(e) => setDraft({ ...draft, taxRate: e.target.value })} />{[['pricesIncludeTax', 'Prices already include tax'], ['discountsStack', 'Quantity discounts and promo codes add up'], ['guestCheckoutEnabled', 'Customers may order without an account']].map(([key, label]) => <div className="module-toggle" key={key}><span>{label}</span><SettingsToggle ariaLabel={label} checked={draft[key]} onChange={(value) => setDraft({ ...draft, [key]: value })} /></div>)}<p className="text-sm text-muted">When discounts do not add up, the better discount applies. Tax is calculated after discounts.</p><button className={`${primaryClass} self-start`}>{busy ? 'Saving…' : 'Save pricing rules'}</button>{notice && <p role="status">{notice}</p>}</fieldset></form>
}
function PromoCodes() {
  const { branding } = useTenant()
  const symbol = branding?.currencySymbol || 'Rs'
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [editor, setEditor] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const remote = useRemote(() => tenant.list('promo-codes', { status, page, limit: 10 }), [status, page])
  const run = async (action) => { setBusy(true); setError(null); setNotice(''); try { await action() } catch (error) { setError(error) } finally { setBusy(false) } }
  return <section className={`${cardClass} module-section`}><header className="flex flex-wrap items-center justify-between gap-3"><h2>Promo Codes</h2><button className={primaryClass} disabled={busy} onClick={() => setEditor({})}>Create promo code</button></header><Field label="Promo code status"><select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>{['all', 'active', 'inactive'].map((value) => <option key={value}>{value}</option>)}</select></Field><ErrorMessage error={error || remote.error} />{notice && <p role="status">{notice}</p>}
    {remote.loading ? <Skeleton variant="table" label="Loading promo codes" columns={7} /> : remote.error ? <button className={buttonClass} onClick={remote.refresh}>Retry</button> : remote.data?.data?.length ? <div className="overflow-x-auto"><table className="module-table"><thead><tr>{['Code', 'Discount', 'Minimum order', 'Uses', 'Dates', 'Status', 'Actions'].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{remote.data.data.map((promo) => <tr key={promo.id}><td><strong>{promo.code}</strong><p>{promo.description}</p></td><td>{promo.type === 'percent' ? `${promo.value}%` : money(promo.value, symbol)}</td><td>{money(promo.minOrder, symbol)}</td><td>{promo.uses ?? 0}{promo.maxUses ? ` / ${promo.maxUses}` : ''}</td><td>{dateTime(promo.startsAt)}<br />{dateTime(promo.expiresAt)}</td><td>{promo.isActive ? 'Active' : 'Off'}</td><td><div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={busy} onClick={() => run(async () => setEditor((await tenant.get(`promo-codes/${promo.id}`)).data))}>Edit {promo.code}</button><button className={buttonClass} disabled={busy} onClick={() => { if (promo.isActive && !window.confirm(`Switch off ${promo.code}?`)) return; run(async () => { if (promo.isActive) await tenant.delete(`promo-codes/${promo.id}`); else await tenant.patch(`promo-codes/${promo.id}`, { isActive: true }); setNotice('Promo code updated.'); await remote.refresh() }) }}>{promo.isActive ? 'Switch off' : 'Switch on'}</button></div></td></tr>)}</tbody></table></div> : <p>No promo codes found.</p>}
    <CatalogPagination pagination={remote.data?.pagination} page={page} count={remote.data?.data?.length || 0} noun="promo codes" onChange={setPage} disabled={remote.loading || busy} />
    {editor && <PromoEditor promo={editor} symbol={symbol} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); setNotice('Promo code saved.'); await remote.refresh() }} />}
  </section>
}
function PromoEditor({ promo, symbol, onClose, onSaved }) {
  const [form, setForm] = useState(promoForm(promo))
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const field = (key, label, props = {}) => <Field label={label} name={key} errors={error?.fieldErrors} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...props} />
  const save = async (event) => { event.preventDefault(); setBusy(true); setError(null); try { const body = promoBody(form, promo.id ? promo : null); if (promo.id) { if (Object.keys(body).length) await tenant.patch(`promo-codes/${promo.id}`, body) } else await tenant.post('promo-codes', body); await onSaved() } catch (error) { setError(error) } finally { setBusy(false) } }
  return <CatalogModal title={promo.id ? `Edit ${promo.code}` : 'Create promo code'} onClose={onClose} busy={busy}><form onSubmit={save}><ErrorMessage error={error} /><fieldset disabled={busy} className="module-section">{field('code', 'Code', { required: true, disabled: !!promo.id })}{field('description', 'Description')}<Field label="Discount type" name="type" errors={error?.fieldErrors}><select className={buttonClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, value: '' })}><option value="percent">Percentage</option><option value="fixed">Fixed amount</option></select></Field><div className="module-grid">{field('value', form.type === 'percent' ? 'Discount (%)' : `Discount (${symbol})`, { type: 'number', min: form.type === 'percent' ? 1 : '0.01', max: form.type === 'percent' ? 100 : undefined, step: form.type === 'percent' ? 'any' : '0.01', required: true })}{field('minOrder', `Minimum order (${symbol})`, { type: 'number', min: 0, step: '0.01', required: true })}{['startsAt', 'expiresAt'].map((key) => <Field key={key} label={key === 'startsAt' ? 'Starts (your local time)' : 'Expires (your local time)'} name={key} errors={error?.fieldErrors} type="datetime-local" value={localDateTime(form[key])} onChange={(e) => setForm({ ...form, [key]: e.target.value ? new Date(e.target.value).toISOString() : '' })} />)}{field('maxUses', 'Total use limit', { type: 'number', min: 1, step: 1, placeholder: 'Unlimited' })}{field('maxUsesPerCustomer', 'Uses per customer', { type: 'number', min: 1, step: 1, placeholder: 'Unlimited' })}</div><div className="flex justify-end gap-3"><button type="button" className={buttonClass} onClick={onClose}>Cancel</button><button className={primaryClass}>{busy ? 'Saving…' : 'Save promo code'}</button></div></fieldset></form></CatalogModal>
}
function QuantityDiscounts() {
  const { user } = useTenant()
  const editable = can(user, 'menu:edit')
  const remote = useRemote(() => tenant.get('discounts/quantity'), [])
  const [editor, setEditor] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const rows = remote.data?.data || []
  const mutate = async (action) => { setBusy(true); setError(null); try { await action(); await remote.refresh() } catch (error) { setError(error) } finally { setBusy(false) } }
  return <section className={`${cardClass} module-section`}><header className="flex flex-wrap items-center justify-between gap-3"><h2>Quantity Discounts</h2>{editable && <button className={primaryClass} disabled={busy} onClick={() => setEditor({})}>Add discount step</button>}</header><p className="text-sm text-muted">Product steps override category steps. The best step reached applies to the whole order line.</p><ErrorMessage error={error || remote.error} />{remote.loading ? <Skeleton variant="table" label="Loading quantity discounts" columns={5} /> : remote.error ? <button className={buttonClass} onClick={remote.refresh}>Retry</button> : rows.length ? <div className="overflow-x-auto"><table className="module-table"><thead><tr><th>Applies to</th><th>Minimum quantity</th><th>Discount</th><th>Status</th>{editable && <th>Actions</th>}</tr></thead><tbody>{rows.map((step) => <tr key={step.id}><td>{step.product?.name || step.productName || step.category?.name || step.categoryName || step.productId || step.categoryId}</td><td>{step.minQuantity}</td><td>{step.percentOff}%</td><td>{step.isActive === false ? 'Off' : 'Active'}</td>{editable && <td><div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={busy} onClick={() => setEditor(step)}>Edit step</button><button className={buttonClass} disabled={busy} onClick={() => mutate(() => tenant.patch(`discounts/quantity/${step.id}`, { isActive: step.isActive === false }))}>{step.isActive === false ? 'Switch on' : 'Switch off'}</button><button className={buttonClass} disabled={busy} onClick={() => { if (window.confirm('Remove this quantity discount step?')) mutate(() => tenant.delete(`discounts/quantity/${step.id}`)) }}>Remove step</button></div></td>}</tr>)}</tbody></table></div> : <p>No quantity discounts yet.</p>}{editor && <QuantityEditor step={editor} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); await remote.refresh() }} />}</section>
}
function QuantityEditor({ step, onClose, onSaved }) {
  const [form, setForm] = useState({ target: 'productId', targetId: '', minQuantity: step.minQuantity ?? 2, percentOff: step.percentOff ?? '' })
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const targets = useRemote(() => step.id ? Promise.resolve(null) : tenant.list(form.target === 'productId' ? 'menu/products' : 'menu/categories', { status: 'all', ...(form.target === 'productId' ? { q, page, limit: 20 } : {}) }), [step.id, form.target, q, page])
  const save = async (event) => { event.preventDefault(); setBusy(true); setError(null); try { const body = quantityBody(form, step.id ? step : null); if (step.id) { if (Object.keys(body).length) await tenant.patch(`discounts/quantity/${step.id}`, body) } else await tenant.post('discounts/quantity', body); await onSaved() } catch (error) { setError(error) } finally { setBusy(false) } }
  return <CatalogModal title={step.id ? 'Edit quantity discount' : 'Add quantity discount'} onClose={onClose} busy={busy}><form onSubmit={save}><ErrorMessage error={error || targets.error} /><fieldset disabled={busy} className="module-section">{!step.id && <><Field label="Applies to"><select className={buttonClass} value={form.target} onChange={(e) => { setForm({ ...form, target: e.target.value, targetId: '' }); setPage(1); setQ('') }}><option value="productId">Product</option><option value="categoryId">Category</option></select></Field>{form.target === 'productId' && <Field label="Search products" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); setForm({ ...form, targetId: '' }) }} />}{targets.loading && <Skeleton label="Loading discount targets" fields={1} />}<Field label="Product or category" name={form.target} errors={error?.fieldErrors}><select className={buttonClass} required value={form.targetId} disabled={targets.loading} onChange={(e) => setForm({ ...form, targetId: e.target.value })}><option value="">Choose…</option>{targets.data?.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><CatalogPagination pagination={targets.data?.pagination} page={page} count={targets.data?.data?.length || 0} onChange={(value) => { setPage(value); setForm({ ...form, targetId: '' }) }} disabled={targets.loading} /></>}<Field label="Minimum quantity" name="minQuantity" errors={error?.fieldErrors} type="number" min={2} max={20} step={1} required value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: e.target.value })} /><Field label="Discount (%)" name="percentOff" errors={error?.fieldErrors} type="number" min="0.01" max={100} step="any" required value={form.percentOff} onChange={(e) => setForm({ ...form, percentOff: e.target.value })} /><div className="flex justify-end gap-3"><button type="button" className={buttonClass} onClick={onClose}>Cancel</button><button className={primaryClass}>{busy ? 'Saving…' : 'Save discount step'}</button></div></fieldset></form></CatalogModal>
}
