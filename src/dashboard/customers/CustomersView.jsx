import { canManagePayments } from '../payments/paymentHelpers'
import { WalletCreditForm } from '../loyalty/WalletCreditForm'
import { Skeleton } from '../shared/Skeleton'
import { useState } from 'react'
import { tenant, money, dateTime } from '../../lib/tenant'
import { useTenant } from '../../lib/TenantContext'
import { useRemote } from '../../lib/useRemote'
import { ErrorMessage, Field, cardClass, buttonClass } from '../shared/ApiUI'
import { CatalogModal, CatalogPagination } from '../shared/CatalogUI'
import '../shared/modules.css'

export function CustomersView({ onNavigate }) {
  const { branding } = useTenant()
  const symbol = branding?.currencySymbol || 'Rs'
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('recent')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const remote = useRemote(() => tenant.list('customers', { q, sort, page, limit: 8 }), [q, sort, page])
  const rows = remote.data?.data || []
  return <div className="mx-auto flex max-w-[1360px] flex-col gap-6">
    <header><h1 className="text-[28px] font-semibold">Customer Directory</h1><p className="text-sm text-muted">Customers with an account at your bakery. Guest orders appear in analytics.</p></header>
    <div className="flex flex-wrap items-end gap-3"><Field label="Search customers" name="q" placeholder="Name, email or phone" maxLength={100} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} /><Field label="Sort customers"><select className={buttonClass} value={sort} onChange={(e) => { setSort(e.target.value); setPage(1) }}><option value="recent">Newest members</option><option value="orders">Most orders</option><option value="spent">Highest spend</option><option value="name">Name A–Z</option></select></Field><button className={buttonClass} onClick={remote.refresh}>Refresh</button></div>
    <ErrorMessage error={remote.error} />
    <section className={cardClass} aria-busy={remote.loading}>
      {remote.loading ? <Skeleton variant="table" label="Loading customers" columns={8} rows={8} /> : remote.error ? <p>Customers could not be loaded. Try Refresh.</p> : rows.length ? <div className="overflow-x-auto"><table className="module-table"><thead><tr>{['Customer', 'Contact', 'Member since', 'Orders', 'Total spent', 'Last order', 'Wallet', 'Points'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((customer) => <tr key={customer.id}><td><button className="font-semibold text-brand underline" onClick={() => setSelected(customer.id)}>{customer.name || 'Unnamed customer'}</button>{customer.isActive === false && <p className="text-muted">Inactive</p>}</td><td>{customer.email}<br />{customer.phone || 'No phone'}</td><td>{dateTime(customer.joinedAt)}</td><td>{customer.orders}</td><td>{money(customer.spent, symbol)}</td><td>{dateTime(customer.lastOrderAt)}</td><td>{money(customer.walletBalance, symbol)}</td><td>{customer.pointsBalance}</td></tr>)}</tbody></table></div> : <p>No customers found.</p>}
      <CatalogPagination pagination={remote.data?.pagination} page={page} count={rows.length} noun="customers" onChange={setPage} disabled={remote.loading} />
    </section>
    {selected && <CustomerDetails id={selected} symbol={symbol} onNavigate={onNavigate} onUpdated={remote.refresh} onClose={() => setSelected(null)} />}
  </div>
}
function CustomerDetails({ id, symbol, onClose, onUpdated, onNavigate }) {
  const { user } = useTenant()
  const [credit, setCredit] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const remote = useRemote(() => tenant.get(`customers/${id}`), [id])
  const customer = remote.data?.data
  const stats = customer?.stats || customer
  return <CatalogModal wide title={credit ? 'Credit customer wallet' : customer?.name || 'Customer details'} busy={busy} onClose={onClose}>
    {notice && <p role="status" className="workspace-notice mb-4">{notice}</p>}
    {credit && customer ? <WalletCreditForm customer={customer} symbol={symbol} onBusy={setBusy} onNavigate={onNavigate} onCancel={async () => { setCredit(false); await Promise.all([remote.refresh(), onUpdated()]) }} onCredited={async () => { setCredit(false); setNotice('Wallet credit added successfully.'); await Promise.all([remote.refresh(), onUpdated()]) }} /> : <>
    <ErrorMessage error={remote.error} />{remote.loading ? <Skeleton variant="detail" label="Loading customer details" /> : remote.error ? <button className={buttonClass} onClick={remote.refresh}>Retry</button> : customer && <div className="flex flex-col gap-5">
      <p>{customer.email} · {customer.phone || 'No phone'}<br />Joined {dateTime(customer.joinedAt)}</p>
      <dl className="grid grid-cols-2 gap-3">{[['Orders', stats.orders], ['Total spent', money(stats.spent, symbol)], ['Average order', money(stats.averageOrder, symbol)], ['Cancelled orders', stats.cancelledOrders], ['Wallet balance', money(customer.walletBalance, symbol)], ['Points', customer.pointsBalance], ['Last order', dateTime(stats.lastOrderAt)]].map(([label, value]) => <div className="rounded-xl bg-gray-50 p-3" key={label}><dt className="text-sm text-muted">{label}</dt><dd className="font-semibold">{value ?? '—'}</dd></div>)}</dl>
      {canManagePayments(user) && <button className={`${buttonClass} self-start`} onClick={() => { setNotice(''); setCredit(true) }}>Add wallet credit</button>}
      <DetailList title="Saved addresses" rows={customer.addresses} render={(a) => [a.label, a.addressLine1, a.addressLine2, a.area, a.city, a.postcode, a.postalCode].filter(Boolean).join(', ')} />
      <DetailList title="Favourites" rows={customer.favourites} render={(p) => p.name || p.productName || p.product?.name} />
      <DetailList title="Most ordered items" rows={customer.topProducts} render={(p) => `${p.name || p.productName} · ${p.quantity ?? p.orders ?? 0}`} />
      <DetailList title="Latest orders" rows={customer.recentOrders} render={(o) => `#${o.number} · ${o.status} · ${money(o.total, symbol)} · ${dateTime(o.createdAt)}`} />
    </div>}
    </>}
  </CatalogModal>
}
function DetailList({ title, rows, render }) {
  return <section><h3 className="mb-2 font-semibold">{title}</h3>{rows?.length ? <ul className="divide-y divide-gray-100">{rows.map((row, index) => <li className="py-2 text-sm" key={row.id || index}>{render(row)}</li>)}</ul> : <p className="text-sm text-muted">None yet.</p>}</section>
}
