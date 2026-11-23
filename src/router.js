const marketingUrl = (import.meta.env.VITE_MARKETING_URL || 'http://localhost:5173').replace(/\/+$/, '')
export const ROUTES = { home: marketingUrl, comingSoon: marketingUrl + '/coming-soon' }
export function navigate(to) { window.location.assign(to) }
