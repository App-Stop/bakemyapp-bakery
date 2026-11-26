import { Skeleton } from './shared/Skeleton'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { tenant, can } from '../lib/tenant'
import { TenantContext } from '../lib/TenantContext'
import { ErrorMessage, buttonClass } from './shared/ApiUI'
import { SignInPage } from './SignInPage'
import { canManagePayments } from './payments/paymentHelpers'
import { AuthPages } from './auth/AuthPages'
import { readAuthRoute } from './auth/authRoutes'

export function TenantSession({ children }) {
  const [user, setUser] = useState(null)
  const [branding, setBranding] = useState(null)
  const [route, setRoute] = useState(readAuthRoute)
  const [loading, setLoading] = useState(() => readAuthRoute() === 'login')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const loadProfile = useCallback(async (sessionUser) => {
    const profile = sessionUser || (await tenant.get('me')).data
    setUser(profile)
    if (can(profile, 'branding:view')) {
      try { setBranding((await tenant.get('branding')).data) } catch { /* The modules remain usable if branding cannot load. */ }
    } else setBranding(null)
  }, [])
  useEffect(() => {
    let active = true
    const expired = () => { setUser(null); setBranding(null) }
    window.addEventListener('tenant-session-expired', expired)
    if (readAuthRoute() === 'login') api.refresh().then(() => { if (active) return loadProfile() }).catch((err) => { if (active && err.status !== 401) setError(err) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; window.removeEventListener('tenant-session-expired', expired) }
  }, [loadProfile])
  useEffect(() => {
    const changed = () => { setRoute(readAuthRoute()); setError(null); setMessage('') }
    window.addEventListener('popstate', changed)
    return () => window.removeEventListener('popstate', changed)
  }, [])
  const navigateAuth = (path, replace = false) => {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
    setRoute(readAuthRoute()); setError(null); setMessage('')
  }
  const authenticate = async (result) => {
    api.setToken(result.data.accessToken)
    await loadProfile(result.data.user)
    navigateAuth('/', true)
  }
  const login = async (event) => {
    event.preventDefault(); setBusy(true); setError(null)
    const form = new FormData(event.currentTarget)
    try {
      const result = await api.post('/v1/tenant/auth/login', { email: form.get('email'), password: form.get('password') }, { authenticated: false })
      await authenticate(result)
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  const logout = async () => {
    try { await tenant.post('auth/logout'); api.setToken(null); setUser(null); setBranding(null) } catch (err) { setError(err) }
  }
  if (route !== 'login') return <AuthPages key={route + window.location.search} mode={route} onNavigate={navigateAuth} onAuthenticated={authenticate} onPasswordReset={() => { api.setToken(null); setUser(null); setBranding(null); navigateAuth('/', true); setMessage('Password reset. Sign in with your new password.') }} />
  if (loading) return <Skeleton variant="session" label="Restoring your session" />
  if (!user) return <SignInPage onSubmit={login} busy={busy} error={error} message={message} onForgot={() => navigateAuth('/forgot-password')} />
  if (!can(user, 'orders:view') && !can(user, 'menu:view') && !can(user, 'branches:view') && !can(user, 'team:view') && !canManagePayments(user)) return <div className="p-10"><p>This account has no access to Menu, Branches, Orders, Team or Payments. Riders use the separate Deliveries portal.</p><button onClick={logout} className={buttonClass}>Sign out</button></div>
  const updateStore = (store) => {
    setUser((previous) => ({ ...previous, tenant: { ...previous.tenant, name: store.name } }))
    setBranding((previous) => ({ ...previous, ...store }))
  }
  return <TenantContext.Provider value={{ user, branding, logout, updateStore, updateUser: setUser }}>{error && <div className="fixed top-4 right-4 z-[60] max-w-md"><ErrorMessage error={error} /></div>}{children}</TenantContext.Provider>
}
