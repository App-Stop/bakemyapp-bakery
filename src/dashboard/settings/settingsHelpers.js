import { changes, toMinor } from '../../lib/tenant.js'

export const storeFields = ['name', 'contactEmail', 'contactPhone', 'address', 'timezone', 'currencyCode', 'appName', 'currencySymbol', 'preset', 'primary']
const nullable = ['contactEmail', 'contactPhone', 'address', 'appName']
export const storeForm = (data) => Object.fromEntries(storeFields.map((key) => [key, data[key] ?? '']))
const normalizeStore = (draft) => Object.fromEntries(storeFields.map((key) => [key, nullable.includes(key) ? draft[key].trim() || null : draft[key]]))
export const storePatch = (base, draft) => changes(normalizeStore(storeForm(base)), normalizeStore(draft))
export const orderForm = (data) => ({ acceptDelivery: data.acceptDelivery, acceptPickup: data.acceptPickup, deliveryMinutes: data.deliveryMinutes ?? '', minimumOrder: data.minimumOrder == null ? '' : String(data.minimumOrder / 100), deliveryRadiusKm: data.deliveryRadiusKm ?? '', taxRate: data.taxRate, taxLabel: data.taxLabel })
export function orderPatch(base, draft) {
  const dirty = changes(orderForm(base), draft)
  if ('minimumOrder' in dirty) dirty.minimumOrder = toMinor(dirty.minimumOrder)
  for (const key of ['deliveryMinutes', 'deliveryRadiusKm', 'taxRate']) if (key in dirty) dirty[key] = dirty[key] === '' ? null : Number(dirty[key])
  return dirty
}
export const week = (hours = []) => Array.from({ length: 7 }, (_, i) => { const day = hours.find((h) => h.day === i + 1); return day ? { day: day.day, isClosed: day.isClosed, opensAt: day.opensAt || '', closesAt: day.closesAt || '' } : { day: i + 1, isClosed: true, opensAt: '', closesAt: '' } })
export const hoursBody = (hours, branchId) => ({ hours: hours.map((day) => day.isClosed ? { day: day.day, isClosed: true } : day), ...(branchId ? { branchIds: [branchId] } : {}) })
export async function validateLogo(file) {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) throw new Error('Choose a PNG, JPEG, WebP or SVG logo.')
  if (file.size > (file.type === 'image/svg+xml' ? 200 * 1024 : 2 * 1024 * 1024)) throw new Error(file.type === 'image/svg+xml' ? 'SVG logos must be at most 200 KB.' : 'Logos must be at most 2 MB.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('This image could not be read.')); image.src = url })
    if (image.naturalWidth < 32 || image.naturalHeight < 32 || image.naturalWidth > 4096 || image.naturalHeight > 4096) throw new Error('The logo must be 32 to 4096 pixels on each side.')
  } finally { URL.revokeObjectURL(url) }
}
