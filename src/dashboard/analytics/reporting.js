import { money } from '../../lib/tenant.js'

export const reportRanges = ['Today', '7d', '30d', '6mo', '1y']
const DAY = 86400000
export function reportDates(range, timezone = 'Asia/Karachi', now = new Date()) {
  const to = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const end = new Date(`${to}T12:00:00Z`)
  const start = new Date(end)
  if (range === '6mo') {
    const day = start.getUTCDate()
    start.setUTCDate(1); start.setUTCMonth(start.getUTCMonth() - 6)
    start.setUTCDate(Math.min(day, new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate()))
  } else start.setUTCDate(start.getUTCDate() - (({ Today: 1, '7d': 7, '30d': 30, '90d': 90, '1y': 365 })[range] || 30) + 1)
  return { from: start.toISOString().slice(0, 10), to, groupBy: (end - start) / DAY > 90 ? 'month' : 'day' }
}
export const comparison = (value) => value == null ? 'No previous sales' : `${value > 0 ? '+' : ''}${value}%`
export function breakdown(rows = [], kind = 'branch') {
  const colors = ['var(--brand)', '#e0cfc2', '#111111', '#6a6a6a', '#a09895', '#5eb6d1', '#ff75ba']
  const amount = (row) => Number(kind === 'status' ? row.orders ?? row.count ?? 0 : row.sales ?? row.orders ?? row.count ?? 0)
  const total = rows.reduce((sum, row) => sum + amount(row), 0)
  return rows.map((row, index) => {
    const value = amount(row)
    return { ...row, name: row.name || row.branchName || row.branch?.name || row[kind] || row.status || 'Unknown', percent: total ? Math.round(value / total * 1000) / 10 : 0, color: colors[index % colors.length] }
  })
}
export function analyticsPresentation(data, symbol) {
  const totals = data?.totals
  const customers = data?.customers
  const peak = data?.busiestHours?.reduce((best, row) => row.orders > (best?.orders || 0) ? row : best, null)
  const max = Math.max(1, ...(data?.series || []).map((row) => row.sales || 0))
  const chartPoints = (data?.series || []).map((row, index, rows) => ({ date: row.period, value: row.sales || 0, valStr: money(row.sales, symbol), x: rows.length === 1 ? 510 : 20 + index / (rows.length - 1) * 980, y: 175 - (row.sales || 0) / max * 160 }))
  return {
    subtitle: data ? `${data.range?.from || ''} – ${data.range?.to || ''} · ${data.groupBy || 'day'} · sales in ${symbol}` : 'Sales for the selected period',
    highlights: [
      { label: 'Sales Growth', value: totals?.salesChange == null ? '—' : comparison(totals.salesChange), subtext: totals?.salesChange == null ? 'No previous-period sales' : 'vs previous equivalent period', isPositive: totals?.salesChange > 0 },
      { label: 'New Customers', value: customers?.new ?? '—', subtext: 'First-time buyers in this period' },
      { label: 'Returning Customers', value: customers?.returning ?? '—', subtext: 'Returning buyers in this period' },
      { label: 'Busiest Hour', value: peak ? `${String(peak.hour).padStart(2, '0')}:00` : '—', subtext: peak ? `${peak.orders} orders · bakery time` : 'No orders in this period' },
    ],
    chartPoints,
    ticks: Array.from({ length: 5 }, (_, i) => ({ y: 15 + i * 40, label: `${symbol || 'Rs'} ${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(max * (1 - i / 4) / 100)}` })),
    defaultHighlightIndex: chartPoints.length - 1,
    topProducts: (data?.topProducts || []).map((row, index) => ({ rank: `#${index + 1}`, name: row.name || row.productName, units: `${row.quantity ?? row.units ?? 0} units`, revenue: money(row.sales, symbol) })),
    categories: breakdown(data?.byBranch),
  }
}

