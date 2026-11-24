import test from 'node:test'
import assert from 'node:assert/strict'
import { canManagePayments, paymentForm, paymentPatch, paymentServiceAdvice, validateStripeKeys } from '../src/dashboard/payments/paymentHelpers.js'

const settings = { cod: { enabled: true, note: 'Exact change' }, card: { enabled: false } }
test('only owners with payment permission can access payments', () => {
  assert.equal(canManagePayments({ role: 'tenant_owner', permissions: ['*'] }), true)
  assert.equal(canManagePayments({ role: 'tenant_owner', permissions: ['payments:manage'] }), true)
  assert.equal(canManagePayments({ role: 'tenant_owner', permissions: [] }), false)
  assert.equal(canManagePayments({ role: 'tenant_manager', permissions: ['*'] }), false)
  assert.equal(canManagePayments({ role: 'rider', permissions: ['deliveries:manage'] }), false)
})
test('payment PATCH only sends changed fields, clears notes with null, and permits an empty confirmation', () => {
  assert.deepEqual(paymentPatch(settings, paymentForm(settings)), {})
  assert.deepEqual(paymentPatch(settings, { codEnabled: true, codNote: '  ', cardEnabled: true }), { codNote: null, cardEnabled: true })
  assert.deepEqual(paymentPatch({ cod: { enabled: true, note: null }, card: { enabled: false } }, { codEnabled: true, codNote: '', cardEnabled: false }), {})
  assert.deepEqual(paymentPatch(settings, { codEnabled: false, codNote: 'Exact change', cardEnabled: false }), { codEnabled: false })
})
test('Stripe key validation requires matching modes without exposing keys in messages', () => {
  assert.deepEqual(validateStripeKeys({ publishableKey: ' pk_test_fixture ', secretKey: ' sk_test_fixture ' }), {})
  assert.deepEqual(validateStripeKeys({ publishableKey: 'pk_live_fixture', secretKey: 'sk_live_fixture' }), {})
  assert.ok(validateStripeKeys({ publishableKey: 'pk_test_fixture', secretKey: 'sk_live_fixture' }).secretKey)
  const errors = validateStripeKeys({ publishableKey: 'invalid-public-fixture', secretKey: 'invalid-private-fixture' })
  assert.ok(errors.publishableKey && errors.secretKey)
  assert.equal(JSON.stringify(errors).includes('invalid-private-fixture'), false)
})
test('key storage outages tell the owner to contact support, while Stripe outages remain retryable', () => {
  assert.match(paymentServiceAdvice({ status: 503, message: 'Card payments cannot be saved right now' }), /Contact Bake My App/)
  assert.equal(paymentServiceAdvice({ status: 503, message: 'Stripe could not be reached' }), null)
  assert.equal(paymentServiceAdvice(null), null)
})
