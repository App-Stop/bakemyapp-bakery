import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeBranchOrders } from '../src/dashboard/branches/branchMetrics.js'
import { loadOrderMetrics } from '../src/dashboard/orders/orderMetrics.js'
import { tenant } from '../src/lib/tenant.js'

test('branch sales use collected money and rank revenue rather than order volume', () => {
  const a = { id: 'a', name: 'Main' }, b = { id: 'b', name: 'Main' }
  const stats = summarizeBranchOrders([
    { branch: a, status: 'completed', total: 1000, currencySymbol: 'Rs' },
    { branch: a, status: 'preparing', paymentStatus: 'paid', total: 500 },
    { branch: a, status: 'cancelled', paymentStatus: 'paid', total: 9000 },
    { branch: a, status: 'placed', paymentStatus: 'unpaid', total: 9000 },
    { branch: b, status: 'completed', total: 3000 },
  ])
  assert.equal(stats.revenue, 4500)
  assert.deepEqual(stats.branches.a, { name: 'Main', revenue: 1500, completed: 1, cancelled: 1 })
  assert.equal(stats.branches.b.revenue, 3000)
  assert.equal(stats.symbol, 'Rs')
  const ranked = summarizeBranchOrders([{ branch: a, status: 'completed', total: 1000 }, { branch: { ...b, name: 'West' }, status: 'completed', total: 3000 }])
  assert.equal(ranked.topBranch, 'West')
  assert.deepEqual(summarizeBranchOrders([]), { branches: {}, revenue: 0, topBranch: '—', symbol: undefined })
})

test('branch totals include every server page using the existing order loader', async () => {
  const original = tenant.list
  const calls = []
  try {
    tenant.list = async (path, params) => {
      calls.push({ path, ...params })
      return { data: [{ status: 'completed', total: params.page * 100, branch: { id: 'a', name: 'Main' } }], pagination: { totalPages: 2 } }
    }
    const stats = await loadOrderMetrics({ from: '2026-11-23', to: '2026-11-23' }, summarizeBranchOrders)
    assert.equal(stats.branches.a.revenue, 300)
    assert.equal(stats.branches.a.completed, 2)
    assert.deepEqual(calls.map((call) => call.page), [1, 2])
    assert.ok(calls.every((call) => call.from === call.to && call.path === 'orders' && call.limit === 100))
  } finally { tenant.list = original }
})
