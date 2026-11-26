import { money } from '../../lib/tenant.js'

const actions = {
  'auth.login': 'signed in',
  'auth.login_failed': 'had an unsuccessful sign-in attempt',
  'auth.login_locked': 'had their sign-in temporarily locked',
  'auth.logout': 'signed out',
  'auth.password_changed': 'changed their password',
  'auth.password_reset_requested': 'requested a password reset',
  'auth.password_reset': 'reset their password',
  'auth.refresh_reuse': 'had a session security issue detected',
  'business.updated': 'updated business details',
  'branding.updated': 'updated branding',
  'branding.logo_uploaded': 'uploaded a bakery logo',
  'branding.logo_removed': 'removed the bakery logo',
  'branch.created': 'added a branch',
  'branch.updated': 'updated a branch',
  'branch.deactivated': 'switched off a branch',
  'branch.reactivated': 'reactivated a branch',
  'branch.hours_updated': 'updated branch hours',
  'branch.paused': 'paused branch orders',
  'branch.resumed': 'resumed branch orders',
  'menu.product_created': 'added a product',
  'menu.product_updated': 'updated a product',
  'menu.product_deactivated': 'switched off a product',
  'menu.product_reactivated': 'reactivated a product',
  'menu.products_reordered': 'reordered products',
  'menu.product_sizes_updated': 'updated product sizes',
  'menu.product_addons_updated': 'updated product add-ons',
  'menu.product_branches_updated': 'updated product availability by branch',
  'menu.product_photo_uploaded': 'uploaded a product photo',
  'menu.product_photo_removed': 'removed a product photo',
  'menu.category_created': 'added a category',
  'menu.category_updated': 'updated a category',
  'menu.category_deactivated': 'switched off a category',
  'menu.category_reactivated': 'reactivated a category',
  'menu.categories_reordered': 'reordered categories',
  'menu.addon_set_created': 'added an add-on group',
  'menu.addon_set_updated': 'updated an add-on group',
  'menu.addon_set_deactivated': 'switched off an add-on group',
  'menu.addon_set_reactivated': 'reactivated an add-on group',
  'menu.addon_options_updated': 'updated add-on options',
  'order.status_changed': 'changed an order status',
  'team.invited': 'invited a team member',
  'team.invite_accepted': 'accepted an invitation',
  'team.invite_revoked': 'cancelled an invitation',
  'team.updated': 'updated a team member',
  'team.profile_updated': 'updated their profile',
  'team.sessions_revoked': 'signed out a team member on all devices',
  'team.unlocked': 'unlocked a team member’s account',
  'payments.updated': 'updated payment settings',
  'payments.stripe_keys_saved': 'updated Stripe keys',
  'payments.stripe_keys_removed': 'removed Stripe keys',
  'payments.stripe_key_tested': 'tested the Stripe connection',
  'payments.stripe_key_failed': 'had a failed Stripe connection test',
  'pricing.updated': 'updated pricing rules',
  'loyalty.updated': 'updated loyalty settings',
  'loyalty.reward_created': 'added a reward',
  'loyalty.reward_updated': 'updated a reward',
  'loyalty.reward_deleted': 'deleted a reward',
  'wallet.credited': 'credited a customer’s wallet',
  'faq.created': 'added a help question',
  'faq.updated': 'updated a help question',
  'faq.deleted': 'deleted a help question',
  'support_ticket.answered': 'replied to a support request',
}
const labels = {
  unit: 'Unit', isNew: 'New product badge', calories: 'Calories', allergens: 'Allergens', ingredients: 'Ingredients',
  isActive: 'Active', isAvailable: 'Available', isClosed: 'Closed', compareAtPrice: 'Original price',
  prepTimeMinutes: 'Preparation time', acceptsDelivery: 'Delivery orders', acceptsPickup: 'Pickup orders',
  deliveryFee: 'Delivery fee', minimumOrder: 'Minimum order', deliveryRadiusKm: 'Delivery radius',
  appName: 'App name', primary: 'Brand colour', preset: 'Colour preset', currencySymbol: 'Currency symbol',
  currencyCode: 'Currency', contactEmail: 'Contact email', contactPhone: 'Contact phone',
  addressLine1: 'Address', addressLine2: 'Address line 2', sortOrder: 'Display order',
  minSelect: 'Minimum selections', maxSelect: 'Maximum selections', taxRate: 'Tax rate',
}
const moneyFields = new Set(['price', 'compareAtPrice', 'deliveryFee', 'minimumOrder', 'amount', 'pointsValueMinor'])
const friendlyLabel = (key) => labels[key] || key.replace(/([a-z\d])([A-Z])/g, '$1 $2').replace(/[_.-]+/g, ' ').replace(/^./, (letter) => letter.toUpperCase())

function textValue(key, value, symbol) {
  if (value == null || value === '') return 'Not set'
  if (typeof value === 'boolean') return key === 'isNew' ? (value ? 'Visible' : 'Hidden') : value ? 'Yes' : 'No'
  if (typeof value === 'number') {
    if (moneyFields.has(key)) return money(value, symbol)
    const units = { calories: ' kcal', prepTimeMinutes: ' min', deliveryRadiusKm: ' km', taxRate: '%' }
    return `${value.toLocaleString('en-GB')}${units[key] || ''}`
  }
  if (Array.isArray(value)) return value.length ? value.map((item) => textValue(key, item, symbol)).join(', ') : 'None'
  if (typeof value === 'object') return Object.entries(value).map(([field, item]) => `${friendlyLabel(field)}: ${textValue(field, item, symbol)}`).join(' · ') || 'Not set'
  if (key === 'allergens') return value.replace(/^./, (letter) => letter.toUpperCase())
  return String(value)
}

export function auditValue(key, value, symbol) {
  const empty = value == null || value === '' || (Array.isArray(value) && !value.length)
  return { empty, items: Array.isArray(value) && value.length ? value.map((item) => textValue(key, item, symbol)) : [textValue(key, value, symbol)] }
}

export function auditEntry(entry, symbol) {
  const actor = entry.actor?.type === 'staff' ? 'Bake My App team' : entry.actor?.type === 'system' ? 'Not signed in' : entry.actor?.name || 'Team member'
  const changes = Object.entries(entry.changes || {}).flatMap(([key, change]) => {
    const paired = change !== null && typeof change === 'object' && !Array.isArray(change) && ('from' in change || 'to' in change)
    if (paired && JSON.stringify(change.from) === JSON.stringify(change.to)) return []
    return [{ key, label: friendlyLabel(key), hasBefore: paired && Object.hasOwn(change, 'from'), before: auditValue(key, paired ? change.from : undefined, symbol), after: auditValue(key, paired ? change.to : change, symbol) }]
  })
  return { actor, action: actions[entry.action] || entry.action || 'recorded an activity', changes }
}
