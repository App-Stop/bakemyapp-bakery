import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { tenant, can } from '../lib/tenant'
import { TenantContext } from '../lib/TenantContext'
import { ErrorMessage, Field, primaryClass, buttonClass } from './shared/ApiUI'

export function TenantSession({ children }) {
  const [user, setUser] = useState(null)
  const [branding, setBranding] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const loadProfile = useCallback(async () => {
    const result = await tenant.get('me')
    setUser(result.data)
    if (can(result.data, 'branding:view')) {
      try { setBranding((await tenant.get('branding')).data) } catch { /* The modules remain usable if branding cannot load. */ }
    }
  }, [])
  useEffect(() => {
    let active = true
    const expired = () => { setUser(null); setBranding(null) }
    window.addEventListener('tenant-session-expired', expired)
    api.refresh().then(() => { if (active) return loadProfile() }).catch((err) => { if (active && err.status !== 401) setError(err) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; window.removeEventListener('tenant-session-expired', expired) }
  }, [loadProfile])
  const login = async (event) => {
    event.preventDefault(); setBusy(true); setError(null)
    const form = new FormData(event.currentTarget)
    try {
      const result = await api.post('/v1/tenant/auth/login', { email: form.get('email'), password: form.get('password') }, { authenticated: false })
      api.setToken(result.data.accessToken)
      await loadProfile()
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  const logout = async () => {
    try { await tenant.post('auth/logout'); api.setToken(null); setUser(null); setBranding(null) } catch (err) { setError(err) }
  }
  if (loading) return <p role="status" className="p-10">Restoring your session…</p>
  if (!user) return <div className="flex min-h-screen items-center justify-center bg-[#f5f5f5] p-5"><form onSubmit={login} className="flex w-full max-w-md flex-col gap-5 rounded-[20px] bg-white p-8"><h1 className="text-2xl font-semibold">Sign in to your bakery</h1><ErrorMessage error={error} /><Field label="Email" name="email" type="email" autoComplete="username" required errors={error?.fieldErrors} /><Field label="Password" name="password" type="password" autoComplete="current-password" required errors={error?.fieldErrors} /><button disabled={busy} className={primaryClass}>{busy ? 'Signing in…' : 'Sign in'}</button></form></div>
  if (!can(user, 'orders:view') && !can(user, 'menu:view') && !can(user, 'branches:view')) return <div className="p-10"><p>This account has no access to Menu, Branches or Orders. Riders use the separate Deliveries portal.</p><button onClick={logout} className={buttonClass}>Sign out</button></div>
  return <TenantContext.Provider value={{ user, branding, logout }}>{error && <div className="fixed top-4 right-4 z-[60] max-w-md"><ErrorMessage error={error} /></div>}{children}</TenantContext.Provider>
}
