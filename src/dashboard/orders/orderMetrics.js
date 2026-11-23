import { tenant } from '../../lib/tenant.js'

export const timeRanges = ['Today', '7d', '30d', '6mo', '1y']

export function rangeDates(range, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const start = new Date(`${today}T12:00:00Z`)
  if (range === '7d') start.setUTCDate(start.getUTCDate() - 6)
  if (range === '30d') start.setUTCDate(start.getUTCDate() - 29)
  if (range === '6mo' || range === '1y') {
    const day = start.getUTCDate()
    start.setUTCDate(1)
    start.setUTCMonth(start.getUTCMonth() - (range === '6mo' ? 6 : 12))
    const last = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate()
    start.setUTCDate(Math.min(day, last))
  }
  return { from: start.toISOString().slice(0, 10), to: today }
}

export function summarizeOrders(orders) {
  const counts = { active: 0, completed: 0, cancelled: 0, all: orders.length }
  const branches = new Map()
  let revenue = 0
  for (const order of orders) {
    if (order.status === 'completed' || order.status === 'cancelled') counts[order.status]++
    else counts.active++
    if (order.status === 'cancelled') continue
    // Revenue is collected money, including completed cash orders.
    if (order.paymentStatus === 'paid' || order.status === 'completed') revenue += order.total || 0
    const key = order.branch?.id || order.branch?.name
    if (key) {
      const branch = branches.get(key) || { name: order.branch.name, count: 0 }
      branch.count++
      branches.set(key, branch)
    }
  }
  const ranked = [...branches.values()].sort((a, b) => b.count - a.count)
  const total = ranked.reduce((sum, branch) => sum + branch.count, 0)
  return { counts, revenue, perBranch: ranked.length ? Math.round(total / ranked.length * 10) / 10 : 0, topBranch: ranked[0]?.name || '—', symbol: orders[0]?.currencySymbol }
}

export async function loadOrderMetrics(params) {
  const orders = []
  let page = 1
  let result
  do {
    result = await tenant.list('orders', { ...params, page, limit: 100 })
    orders.push(...result.data)
    page++
  } while (page <= (result.pagination?.totalPages || 1))
  return summarizeOrders(orders)
}
