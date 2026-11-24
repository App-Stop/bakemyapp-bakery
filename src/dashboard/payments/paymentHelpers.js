import { can, changes } from '../../lib/tenant.js'

export const canManagePayments = (user) => user?.role === 'tenant_owner' && can(user, 'payments:manage')
export const paymentForm = (settings) => ({ codEnabled: settings.cod.enabled, codNote: settings.cod.note || '', cardEnabled: settings.card.enabled })
export const paymentPatch = (settings, form) => changes({ ...paymentForm(settings), codNote: settings.cod.note || null }, { ...form, codNote: form.codNote.trim() || null })

export function validateStripeKeys({ publishableKey, secretKey }) {
  const errors = {}
  const publishable = /^pk_(test|live)_\S+$/.exec(publishableKey.trim())
  const secret = /^sk_(test|live)_\S+$/.exec(secretKey.trim())
  if (!publishable) errors.publishableKey = 'Enter a Stripe publishable key starting with pk_test_ or pk_live_.'
  if (!secret) errors.secretKey = 'Enter a Stripe secret key starting with sk_test_ or sk_live_.'
  if (publishable && secret && publishable[1] !== secret[1]) errors.secretKey = 'Both keys must use the same mode: test or live.'
  return errors
}

export const paymentServiceAdvice = (error) => error?.status === 503 && /card payments cannot be saved right now/i.test(error.message) ? 'Contact Bake My App to enable secure key storage for your bakery.' : null
