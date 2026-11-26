import { api } from './api.js'

const root = '/v1/tenant'
const changed = (path, request) => request.then((result) => {
  if (typeof window !== 'undefined' && /^(business|branding|store|branches|menu|payments|team)(\/|$)/.test(path)) window.dispatchEvent(new Event('tenant-setup-changed'))
  return result
})
export const queryString = (params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null))
  return query.size ? `?${query}` : ''
}
export const tenant = {
  list: (path, params, options) => api.get(`${root}/${path}${queryString(params)}`, options),
  get: (path, options) => api.get(`${root}/${path}`, options),
  post: (path, body, options) => changed(path, api.post(`${root}/${path}`, body, options)),
  patch: (path, body) => changed(path, api.patch(`${root}/${path}`, body)),
  put: (path, body) => changed(path, api.put(`${root}/${path}`, body)),
  delete: (path) => changed(path, api.delete(`${root}/${path}`)),
}
export const can = (user, permission) => user?.permissions?.some((item) => item === '*' || item === permission) || false
export const money = (amount, symbol = 'Rs') => amount == null ? '—' : `${symbol} ${(amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const toMinor = (value) => {
  if (!/^\d+(\.\d{1,2})?$/.test(String(value))) throw new Error('Enter an amount with up to two decimal places.')
  const amount = Math.round(Number(value) * 100)
  if (!Number.isSafeInteger(amount)) throw new Error('This amount is too large.')
  return amount
}
export const changes = (before, after) => Object.fromEntries(Object.entries(after).filter(([key, value]) => JSON.stringify(before[key] ?? null) !== JSON.stringify(value ?? null)))
export const dateTime = (value) => value ? new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Karachi' }) : '—'
