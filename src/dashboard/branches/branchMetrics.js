export function summarizeBranchOrders(orders) {
  const branches = {}
  let revenue = 0
  for (const order of orders) {
    const id = order.branch?.id
    if (!id) continue
    const branch = branches[id] ||= { name: order.branch.name, revenue: 0, completed: 0, cancelled: 0 }
    if (order.status === 'completed') branch.completed++
    if (order.status === 'cancelled') branch.cancelled++
    else if (order.paymentStatus === 'paid' || order.status === 'completed') {
      branch.revenue += order.total || 0
      revenue += order.total || 0
    }
  }
  const top = Object.values(branches).filter((branch) => branch.revenue > 0).sort((a, b) => b.revenue - a.revenue)[0]
  return { branches, revenue, topBranch: top?.name || '—', symbol: orders[0]?.currencySymbol }
}
