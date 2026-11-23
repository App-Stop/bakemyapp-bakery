import test from 'node:test'
import assert from 'node:assert/strict'
import { rangeDates, summarizeOrders, loadOrderMetrics } from '../src/dashboard/orders/orderMetrics.js'
import { tenant } from '../src/lib/tenant.js'

test('order ranges use Karachi dates, inclusive days and clamped calendar months', () => {
  const now = new Date('2026-11-22T21:00:00Z')
  assert.deepEqual(rangeDates('Today', now), { from: '2026-11-23', to: '2026-11-23' })
  assert.deepEqual(rangeDates('7d', now), { from: '2026-11-17', to: '2026-11-23' })
  assert.deepEqual(rangeDates('30d', now), { from: '2026-10-25', to: '2026-11-23' })
  assert.deepEqual(rangeDates('6mo', new Date('2026-08-31T10:00Z')), { from: '2026-02-28', to: '2026-08-31' })
  assert.deepEqual(rangeDates('1y', new Date('2024-02-29T10:00Z')), { from: '2023-02-28', to: '2024-02-29' })
})

test('metrics exclude cancelled and unpaid revenue and count branches by ID', () => {
  const branch = { id: 'a', name: 'Main' }
  const stats = summarizeOrders([
    { status: 'completed', total: 12000, paymentStatus: 'paid', branch, currencySymbol: 'Rs' },
    { status: 'preparing', total: 5000, paymentStatus: 'paid', branch },
    { status: 'placed', total: 2000, paymentStatus: 'unpaid', branch: { id: 'b', name: 'Main' } },
    { status: 'cancelled', total: 9000, paymentStatus: 'refunded', branch },
  ])
  assert.deepEqual(stats.counts, { active: 2, completed: 1, cancelled: 1, all: 4 })
  assert.equal(stats.revenue, 17000)
  assert.equal(stats.perBranch, 1.5)
  assert.equal(stats.topBranch, 'Main')
  assert.equal(summarizeOrders([]).topBranch, '—')
})

test('metrics read all server pages with the selected dates and branch', async () => {
  const original = tenant.list
  const calls = []
  try {
    tenant.list = async (path, params) => {
      calls.push({ path, ...params })
      return { data: [{ status: 'completed', total: params.page * 100, branch: { id: 'a', name: 'Main' } }], pagination: { totalPages: 2 } }
    }
    const stats = await loadOrderMetrics({ from: '2026-11-17', to: '2026-11-23', branchId: 'a' })
    assert.equal(stats.revenue, 300)
    assert.equal(stats.counts.completed, 2)
    assert.deepEqual(calls.map((call) => call.page), [1, 2])
    assert.ok(calls.every((call) => call.path === 'orders' && call.branchId === 'a' && call.from === '2026-11-17' && call.limit === 100))
  } finally { tenant.list = original }
})
