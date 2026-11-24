import { useRef, useState } from 'react'
import { tenant } from '../../lib/tenant'
import { ErrorMessage } from '../shared/ApiUI'
import { CatalogField, CatalogModal } from '../shared/CatalogUI'
import { paymentServiceAdvice, validateStripeKeys } from './paymentHelpers'

export function StripeKeysForm({ configured, onClose, onSaved }) {
  const [form, setForm] = useState({ publishableKey: '', secretKey: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const save = async (event) => {
    event.preventDefault()
    if (inFlight.current) return
    const fieldErrors = validateStripeKeys(form)
    if (Object.keys(fieldErrors).length) { setError({ message: 'Check your Stripe keys.', fieldErrors }); return }
    inFlight.current = true; setBusy(true); setError(null)
    try {
      const result = await tenant.put('payments/stripe-keys', { publishableKey: form.publishableKey.trim(), secretKey: form.secretKey.trim() })
      setForm({ publishableKey: '', secretKey: '' })
      onSaved(result.data)
    } catch (err) { setError(err) } finally { inFlight.current = false; setBusy(false) }
  }
  return <CatalogModal title={configured ? 'Replace Stripe keys' : 'Connect Stripe'} description="Copy the publishable and secret keys from your bakery’s own Stripe account. Both keys must be in the same mode." onClose={onClose} busy={busy} className="payments-key-modal">
    <form className="catalog-form" onSubmit={save} autoComplete="off"><ErrorMessage error={error} />{paymentServiceAdvice(error) && <p role="alert" className="payments-help">{paymentServiceAdvice(error)}</p>}<fieldset className="catalog-form" disabled={busy}>
      <CatalogField label="Publishable key" name="publishableKey" placeholder="pk_test_… or pk_live_…" value={form.publishableKey} onChange={(event) => setForm((previous) => ({ ...previous, publishableKey: event.target.value }))} required autoComplete="off" spellCheck={false} autoCapitalize="none" errors={error?.fieldErrors} />
      <CatalogField label="Secret key" name="secretKey" type="password" placeholder="sk_test_… or sk_live_…" value={form.secretKey} onChange={(event) => setForm((previous) => ({ ...previous, secretKey: event.target.value }))} required autoComplete="new-password" spellCheck={false} autoCapitalize="none" errors={error?.fieldErrors} />
      <p className="payments-help">The secret key is checked with Stripe before saving. It will be cleared from this form after saving and cannot be viewed again.</p>
      <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className="payments-link">Open Stripe API keys ↗</a>
      <div className="payments-actions"><button type="button" className="catalog-button" onClick={onClose}>Cancel</button><button type="submit" className="catalog-button catalog-primary" disabled={busy}>{busy ? 'Checking and saving…' : 'Save Stripe keys'}</button></div>
    </fieldset></form>
  </CatalogModal>
}
