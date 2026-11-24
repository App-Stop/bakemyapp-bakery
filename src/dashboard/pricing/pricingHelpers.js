import { changes, toMinor } from '../../lib/tenant.js'
export const promoForm = (data = {}) => ({ code: data.code || '', description: data.description || '', type: data.type || 'percent', value: data.value == null ? '' : String(data.type === 'fixed' ? data.value / 100 : data.value), minOrder: String((data.minOrder || 0) / 100), startsAt: data.startsAt || '', expiresAt: data.expiresAt || '', maxUses: data.maxUses ?? '', maxUsesPerCustomer: data.maxUsesPerCustomer ?? '' })
export function promoBody(form, original) {
  const body = { code: form.code.trim(), description: form.description.trim() || null, type: form.type, value: form.type === 'fixed' ? toMinor(form.value) : Number(form.value), minOrder: toMinor(form.minOrder), startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null, expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null, maxUses: form.maxUses === '' ? null : Number(form.maxUses), maxUsesPerCustomer: form.maxUsesPerCustomer === '' ? null : Number(form.maxUsesPerCustomer) }
  if (body.value <= 0 || (body.type === 'percent' && body.value > 100)) throw new Error('Enter a positive discount, at most 100 for a percentage.')
  if (body.startsAt && body.expiresAt && body.startsAt >= body.expiresAt) throw new Error('Expiry must be after the start date.')
  if (original) { delete body.code; return changes(original, body) }
  return body
}
export function quantityBody(form, original) {
  const body = { minQuantity: Number(form.minQuantity), percentOff: Number(form.percentOff) }
  if (!Number.isInteger(body.minQuantity) || body.minQuantity < 2 || body.minQuantity > 20) throw new Error('Minimum quantity must be a whole number from 2 to 20.')
  if (!(body.percentOff > 0 && body.percentOff <= 100)) throw new Error('Discount must be greater than 0 and at most 100%.')
  if (original) return changes(original, body)
  if (!form.targetId || !['productId', 'categoryId'].includes(form.target)) throw new Error('Choose a product or category.')
  return { ...body, [form.target]: form.targetId }
}
// datetime-local uses the browser's time zone; convert instants before displaying them.
export const localDateTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
