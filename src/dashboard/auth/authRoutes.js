export function readAuthRoute() {
  const path = window.location.pathname.replace(/\/+$/, '')
  return ({ '/accept-invite': 'invite', '/forgot-password': 'forgot', '/reset-password': 'reset' })[path] || 'login'
}
