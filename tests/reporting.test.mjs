import test from 'node:test'
import assert from 'node:assert/strict'
import { analyticsPresentation, breakdown, reportDates } from '../src/dashboard/analytics/reporting.js'
import { auditEntry, auditValue } from '../src/dashboard/overview/audit.js'
import { createApiClient } from '../src/lib/api.js'

test('report periods follow bakery dates and remain within the inclusive API limit', () => {
  const now = new Date('2024-03-01T02:00:00Z')
  assert.deepEqual(reportDates('Today', 'America/New_York', now), { from: '2024-02-29', to: '2024-02-29', groupBy: 'day' })
  assert.equal(reportDates('7d', 'Asia/Karachi', now).from, '2024-02-24')
  assert.deepEqual(reportDates('6mo', 'UTC', new Date('2026-08-31T12:00:00Z')), { from: '2026-02-28', to: '2026-08-31', groupBy: 'month' })
  const year = reportDates('1y', 'UTC', now)
  assert.equal((new Date(year.to) - new Date(year.from)) / 86400000 + 1, 365)
})

test('real reports preserve negative/null comparisons, scale integer money and handle empty charts', () => {
  const view = analyticsPresentation({ totals: { salesChange: -12 }, customers: { new: 3, returning: 2 }, series: [{ period: '2026-11-26', sales: 123456 }], topProducts: [{ name: 'Cake', quantity: 4, sales: 123456 }], busiestHours: [{ hour: 9, orders: 3 }, { hour: 14, orders: 10 }] }, 'Rs')
  assert.equal(view.highlights[0].value, '-12%')
  assert.equal(view.highlights[3].value, '14:00')
  assert.equal(view.chartPoints[0].valStr, 'Rs 1,234.56')
  assert.equal(view.chartPoints[0].x, 510)
  assert.equal(view.chartPoints[0].y, 15)
  assert.equal(analyticsPresentation({ totals: { salesChange: null } }, 'Rs').highlights[0].value, '—')
  assert.deepEqual(analyticsPresentation(null, 'Rs').chartPoints, [])
  assert.ok(analyticsPresentation({ series: [{ sales: 0 }] }, 'Rs').chartPoints.every((p) => Number.isFinite(p.y)))
  assert.deepEqual(breakdown([{ name: 'A', sales: 0 }, { name: 'B', sales: 0 }]).map((r) => r.percent), [0, 0])
})

test('audit displays protect staff identity and retain unknown actions and change fields', () => {
  const entry = auditEntry({ actor: { type: 'staff', name: 'Private name' }, action: 'future.action', changes: { enabled: { from: false, to: true }, newField: ['a'] } })
  assert.equal(entry.actor, 'Bake My App team')
  assert.equal(entry.action, 'future.action')
  assert.deepEqual(entry.changes[0].before.items, ['No'])
  assert.deepEqual(entry.changes[0].after.items, ['Yes'])
  assert.equal(entry.changes[1].label, 'New Field')
  assert.equal(entry.changes[1].hasBefore, false)
  assert.deepEqual(entry.changes[1].after.items, ['a'])
})

test('product audit changes use readable labels and typed values without losing empty or false states', () => {
  const entry = auditEntry({ action: 'menu.product_updated', actor: { type: 'user', name: 'Demo Bakery Owner' }, changes: {
    unit: { from: null, to: '1 kg' }, isNew: { from: false, to: true }, calories: { from: null, to: 420 },
    allergens: { from: [], to: ['dairy', 'eggs', 'gluten'] }, ingredients: { from: [], to: ['Cocoa', 'Butter', 'Eggs', 'Flour'] },
  } })
  assert.equal(entry.action, 'updated a product')
  assert.deepEqual(entry.changes.map((change) => change.label), ['Unit', 'New product badge', 'Calories', 'Allergens', 'Ingredients'])
  assert.deepEqual(entry.changes[0].before, { empty: true, items: ['Not set'] })
  assert.deepEqual(entry.changes[1].before.items, ['Hidden'])
  assert.deepEqual(entry.changes[1].after.items, ['Visible'])
  assert.deepEqual(entry.changes[2].after.items, ['420 kcal'])
  assert.deepEqual(entry.changes[3].before.items, ['None'])
  assert.deepEqual(entry.changes[3].after.items, ['Dairy', 'Eggs', 'Gluten'])
  assert.deepEqual(entry.changes[4].after.items, ['Cocoa', 'Butter', 'Eggs', 'Flour'])
  assert.deepEqual(auditValue('price', 0, 'Rs').items, ['Rs 0.00'])
  assert.deepEqual(auditValue('isActive', false).items, ['No'])
  assert.equal(auditEntry({ changes: { name: { from: 'Same', to: 'Same' } } }).changes.length, 0)
})

test('invitation and recovery errors never send a session token or trigger refresh', async () => {
  let calls = 0
  const client = createApiClient({ baseUrl: 'https://fixture.test', fetcher: async (url, options) => {
    calls++; assert.equal(options.headers.Authorization, undefined); assert.equal(options.credentials, 'include')
    assert.ok(!url.endsWith('/auth/refresh'))
    return new Response(JSON.stringify({ success: false, message: 'Invalid link' }), { status: 401 })
  } })
  client.setToken('existing-session')
  for (const path of ['accept-invite', 'forgot-password', 'reset-password']) await assert.rejects(client.post('/v1/tenant/auth/' + path, {}, { authenticated: false }), { status: 401 })
  assert.equal(calls, 3)
})
