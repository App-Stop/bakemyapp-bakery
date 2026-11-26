import { can } from '../../lib/tenant.js'

const destinations = { business: ['settings', 'business:view'], branding: ['settings', 'branding:view'], branch: ['branches', 'branches:view'], branches: ['branches', 'branches:view'], menu: ['menu', 'menu:view'], payments: ['payments', 'payments:manage'], team: ['team', 'team:view'] }
export function setupDestination(item, user) {
  const key = item.key || item.route?.split('/').filter(Boolean).at(-1)
  const target = destinations[key]
  return target && can(user, target[1]) ? target[0] : null
}
export function planPrice(price) {
  if (!price) return 'Custom'
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: price.currency.toUpperCase() }).format(price.amount / 100) } catch { return `${price.currency || ''} ${(price.amount / 100).toFixed(2)}` }
}
export const planDate = (value) => value ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Not scheduled'
