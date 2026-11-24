import { Skeleton } from '../shared/Skeleton'
import { useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { CreditCardIcon, Money01Icon } from '@hugeicons/core-free-icons'
import { dateTime, tenant } from '../../lib/tenant'
import { useTenant } from '../../lib/TenantContext'
import { useRemote } from '../../lib/useRemote'
import { ErrorMessage } from '../shared/ApiUI'
import { CatalogField, CatalogModal } from '../shared/CatalogUI'
import { SettingsToggle } from '../settings/SettingsToggle'
import { StripeKeysForm } from './StripeKeysForm'
import { canManagePayments, paymentForm, paymentPatch, paymentServiceAdvice } from './paymentHelpers'
import './payments.css'

function PaymentSettings({ initial }) {
  const { user } = useTenant()
  const [settings, setSettings] = useState(initial)
  const [form, setForm] = useState(() => paymentForm(initial))
  const [busy, setBusy] = useState('')
  const inFlight = useRef(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [keysOpen, setKeysOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const patch = paymentPatch(settings, form)
  const dirty = Object.keys(patch).length > 0
  const apply = (next) => { setSettings(next); setForm(paymentForm(next)) }
  const run = async (name, operation) => {
    if (inFlight.current) return
    inFlight.current = true; setBusy(name); setError(null); setNotice('')
    try { await operation() } catch (err) { setError(err) } finally { inFlight.current = false; setBusy('') }
  }
  const save = (event) => {
    event.preventDefault()
    run('save', async () => { const result = await tenant.patch('payments', patch); apply(result.data); setNotice('Payment preferences saved.') })
  }
  const refresh = () => run('refresh', async () => { apply((await tenant.get('payments')).data); setNotice('Payment settings refreshed.') })
  const test = () => run('test', async () => {
    const result = await tenant.post('payments/stripe-keys/test')
    // A failed test is a successful HTTP response that has already switched cards off.
    apply(result.data.payments)
    setNotice(result.data.ok ? 'Stripe accepted your saved key. Card payments are ready to enable.' : '')
    if (!result.data.ok) setError('Stripe no longer accepts your key. Cards are off. Save a working key.')
  })
  const remove = () => run('remove', async () => { apply((await tenant.delete('payments/stripe-keys')).data); setRemoveOpen(false); setNotice('Stripe keys removed. Card payments are off.') })
  const update = (key, value) => setForm((previous) => ({ ...previous, [key]: value }))
  const { cod, card } = settings
  const removalBlocked = card.enabled && !cod.enabled
  return <div className="catalog-page payments-page">
    <header className="catalog-header"><div><h1>Payments</h1><p>Choose how customers pay your bakery.</p></div><button className="catalog-button" disabled={!!busy || dirty} onClick={refresh}>{busy === 'refresh' ? 'Refreshing…' : 'Refresh settings'}</button></header>
    <div className={`payments-overview ${settings.usable ? 'payments-overview-ready' : ''}`}><span className="payments-overview-dot" /><div><strong>{settings.usable ? 'Your bakery can accept payments' : 'Set up a way for customers to pay'}</strong><p>{settings.usable ? `${[cod.enabled ? 'Cash on delivery' : '', card.enabled && card.ready ? 'Card payments' : ''].filter(Boolean).join(' and ')} available at checkout.` : 'Switch on cash on delivery, or connect Stripe and enable cards.'}</p></div><span className="payments-badge">{settings.confirmedAt ? 'Preferences confirmed' : 'Setup required'}</span></div>
    <ErrorMessage error={removeOpen ? null : error} />{paymentServiceAdvice(error) && !removeOpen && <p role="alert" className="payments-help">{paymentServiceAdvice(error)}</p>}
    {notice && <p role="status" className="catalog-notice">{notice}</p>}
    {card.mode === 'test' && <p role="status" className="payments-warning">{user.tenant?.status === 'live' ? 'Your bakery is live. ' : ''}Test mode: no real money is taken. Save live Stripe keys before accepting real card payments.</p>}
    <form onSubmit={save} className="payments-preferences"><fieldset disabled={!!busy} className="payments-grid">
      <section className="payments-card"><header><div className="payments-method-icon" aria-hidden="true"><HugeiconsIcon icon={Money01Icon} size={24} /></div><div><h2>Cash on delivery</h2><p>Customers pay when their order arrives.</p></div><SettingsToggle ariaLabel="Enable cash on delivery" checked={form.codEnabled} onChange={(value) => update('codEnabled', value)} disabled={!!busy} /></header>
        <div className="payments-card-body"><span className={`payments-badge ${cod.enabled ? 'payments-badge-good' : ''}`}>{cod.enabled ? 'Enabled at checkout' : 'Not enabled'}</span><CatalogField label="Customer note (optional)" name="codNote" value={form.codNote} placeholder="e.g. Please have exact change ready" onChange={(event) => update('codNote', event.target.value)} errors={typeof error === 'object' ? error?.fieldErrors : {}} /><p className="payments-help">Shown to customers choosing cash. Leave it blank to remove the note.</p>{error?.fieldErrors?.codEnabled && <p role="alert" className="payments-field-error">{error.fieldErrors.codEnabled}</p>}</div>
      </section>
      <section className="payments-card"><header><div className="payments-method-icon payments-card-icon" aria-hidden="true"><HugeiconsIcon icon={CreditCardIcon} size={24} /></div><div><h2>Card payments</h2><p>Paid directly into your Stripe account.</p></div><SettingsToggle ariaLabel="Enable card payments" checked={form.cardEnabled} onChange={(value) => update('cardEnabled', value)} disabled={!!busy || !card.ready} /></header>
        <div className="payments-card-body"><div className="payments-badges"><span className={`payments-badge ${card.enabled && card.ready ? 'payments-badge-good' : ''}`}>{card.enabled && card.ready ? 'Enabled at checkout' : 'Not enabled'}</span><span className={`payments-badge ${card.ready ? 'payments-badge-good' : ''}`}>{!card.configured ? 'No keys saved' : card.ready ? 'Key verified' : 'Key needs attention'}</span>{card.mode && <span className="payments-badge">{card.mode === 'test' ? 'Test mode' : 'Live mode'}</span>}</div>
          {!card.ready && <p className="payments-help">Save working Stripe keys before switching on card payments.</p>}{card.ready && !card.enabled && <p className="payments-help">Your key is working. Switch on card payments and save your preferences to offer cards at checkout.</p>}
          {error?.fieldErrors?.cardEnabled && <p role="alert" className="payments-field-error">{error.fieldErrors.cardEnabled}</p>}
          <dl className="payments-key-summary"><div><dt>Secret key</dt><dd>{card.secretKeyHint || 'Not connected'}</dd></div>{card.accountId && <div><dt>Stripe account</dt><dd>{card.accountId}</dd></div>}<div><dt>Last verified (Karachi)</dt><dd>{card.verifiedAt ? dateTime(card.verifiedAt) : 'Not yet verified'}</dd></div></dl>
          <p className="payments-help">Card payments go to your bakery’s own Stripe account. Bake My App never holds the money.</p>
        </div>
      </section>
    </fieldset><div className="payments-save-bar"><div><p>{dirty ? 'You have unsaved payment preferences.' : settings.confirmedAt ? `Last confirmed ${dateTime(settings.confirmedAt)} (Karachi)` : 'Save your preferences to complete payment setup.'}</p>{dirty && <button className="payments-link" type="button" disabled={!!busy} onClick={() => { setForm(paymentForm(settings)); setError(null) }}>Discard changes</button>}</div><button type="submit" className="catalog-button catalog-primary" disabled={!!busy}>{busy === 'save' ? 'Saving…' : 'Save payment preferences'}</button></div></form>
    <section className="payments-stripe-panel"><div><h2>Stripe connection</h2><p>{card.configured ? 'Replace, verify, or remove your saved keys.' : 'Connect your account to start accepting cards.'}</p>{dirty && <p className="payments-help">Save or discard payment preferences before managing Stripe keys.</p>}</div><div className="payments-actions"><button className="catalog-button catalog-primary" disabled={!!busy || dirty} onClick={() => { setError(null); setNotice(''); setKeysOpen(true) }}>{card.configured ? 'Replace keys' : 'Connect Stripe'}</button>{card.configured && <><button className="catalog-button" disabled={!!busy || dirty} onClick={test}>{busy === 'test' ? 'Testing…' : 'Test saved key'}</button><button className="catalog-button payments-danger" disabled={!!busy || dirty} onClick={() => { setError(null); setRemoveOpen(true) }}>Remove keys</button></>}</div></section>
    {keysOpen && <StripeKeysForm configured={card.configured} onClose={() => setKeysOpen(false)} onSaved={(next) => { apply(next); setKeysOpen(false); setError(null); setNotice('Stripe keys saved and verified. Review your payment preferences to enable cards.') }} />}
    {removeOpen && <CatalogModal title="Remove Stripe keys?" description="Card payments will be switched off. Automatic refunds for existing card payments may fail after removal; arrange those refunds in Stripe." onClose={() => { if (!busy) { setRemoveOpen(false); setError(null) } }} busy={!!busy}><ErrorMessage error={error} />{removalBlocked && <p role="alert" className="payments-warning">Cards are your only payment method. Turn on cash on delivery and save your preferences before removing keys.</p>}<div className="payments-actions"><button autoFocus className="catalog-button" disabled={!!busy} onClick={() => { setRemoveOpen(false); setError(null) }}>Keep keys</button><button className="catalog-button payments-danger" disabled={!!busy || removalBlocked} onClick={remove}>{busy === 'remove' ? 'Removing…' : 'Confirm removal'}</button></div></CatalogModal>}
  </div>
}

function PaymentLoader() {
  const remote = useRemote(() => tenant.get('payments'), [])
  if (!remote.data) return <div className="catalog-page payments-page"><header className="catalog-header"><div><h1>Payments</h1><p>Choose how customers pay your bakery.</p></div></header>{remote.loading && <Skeleton variant="cards" label="Loading payment settings" rows={2} />}<ErrorMessage error={remote.error} />{remote.error && <button className="catalog-button self-start" onClick={remote.refresh} disabled={remote.loading}>Try again</button>}</div>
  return <PaymentSettings initial={remote.data.data} />
}

export function PaymentsView() {
  const { user } = useTenant()
  return canManagePayments(user) ? <PaymentLoader /> : <p role="alert">Only the bakery owner can manage payment settings.</p>
}
