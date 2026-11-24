import assert from 'node:assert/strict'
import test from 'node:test'
import { storeForm, storePatch, orderForm, orderPatch, hoursBody, week } from '../src/dashboard/settings/settingsHelpers.js'
import { promoForm, promoBody, quantityBody } from '../src/dashboard/pricing/pricingHelpers.js'

test('settings preserve untouched nulls and mixed branch values, and convert money only on edit', () => {
  const store = { name: 'Bakery', contactEmail: null, contactPhone: null, address: null, timezone: 'Asia/Karachi', currencyCode: 'PKR', currencySymbol: 'Rs', appName: null, preset: 'custom', primary: '#C15400' }
  assert.deepEqual(storePatch(store, storeForm(store)), {})
  assert.deepEqual(storePatch({ ...store, address: 'Old address' }, { ...storeForm(store), name: 'New name' }), { name: 'New name', address: null })
  const orders = { acceptDelivery: true, acceptPickup: true, deliveryMinutes: null, minimumOrder: null, deliveryRadiusKm: null, taxRate: 0, taxLabel: 'Tax', branchesDiffer: { minimumOrder: true, deliveryRadiusKm: true } }
  assert.deepEqual(orderPatch(orders, orderForm(orders)), {})
  assert.deepEqual(orderPatch(orders, { ...orderForm(orders), minimumOrder: '10.50', deliveryRadiusKm: '1.609344' }), { minimumOrder: 1050, deliveryRadiusKm: 1.609344 })
  assert.deepEqual(orderPatch({ ...orders, deliveryRadiusKm: 5 }, { ...orderForm(orders) }), { deliveryRadiusKm: null })
  assert.throws(() => orderPatch(orders, { ...orderForm(orders), minimumOrder: '-1' }))
})
test('hours replace seven complete days and omit times for closed days', () => {
  const hours = week([{ day: 1, isClosed: false, opensAt: '09:00', closesAt: '21:00' }])
  const body = hoursBody(hours, 'branch-1')
  assert.equal(body.hours.length, 7)
  assert.deepEqual(body.hours[6], { day: 7, isClosed: true })
  assert.deepEqual(body.branchIds, ['branch-1'])
  assert.equal('branchIds' in hoursBody(hours, ''), false)
})
test('promo edits never rename codes; fixed money, null limits, and dates match API', () => {
  const promo = { code: 'BAKE', description: null, type: 'fixed', value: 1050, minOrder: 10000, startsAt: null, expiresAt: null, maxUses: null, maxUsesPerCustomer: 2 }
  assert.deepEqual(promoBody(promoForm(promo), promo), {})
  assert.deepEqual(promoBody({ ...promoForm(promo), code: 'RENAMED', value: '12.99', maxUsesPerCustomer: '' }, promo), { value: 1299, maxUsesPerCustomer: null })
  assert.equal(promoBody(promoForm(promo)).value, 1050)
  assert.throws(() => promoBody({ ...promoForm(promo), type: 'percent', value: '101' }))
  assert.throws(() => promoBody({ ...promoForm(promo), startsAt: '2026-11-25T10:00:00Z', expiresAt: '2026-11-24T10:00:00Z' }))
})
test('quantity discounts have exactly one target and cannot retarget an existing step', () => {
  assert.deepEqual(quantityBody({ target: 'categoryId', targetId: 'cat-1', minQuantity: '3', percentOff: '10' }), { categoryId: 'cat-1', minQuantity: 3, percentOff: 10 })
  assert.deepEqual(quantityBody({ target: 'productId', targetId: 'product-2', minQuantity: '4', percentOff: '10' }, { minQuantity: 3, percentOff: 10 }), { minQuantity: 4 })
  assert.throws(() => quantityBody({ target: 'productId', targetId: '', minQuantity: '2', percentOff: '10' }))
  assert.throws(() => quantityBody({ target: 'productId', targetId: 'p', minQuantity: '2.5', percentOff: '10' }))
})
