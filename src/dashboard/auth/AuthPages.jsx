import { useState } from 'react'
import { api, ApiError } from '../../lib/api'
import { ErrorMessage, Field } from '../shared/ApiUI'
import { AuthLayout, PasswordField } from './AuthLayout'


const titles = { invite: 'Accept your invitation', forgot: 'Forgot password?', reset: 'Reset your password' }
const descriptions = {
  invite: 'Choose a password to join your bakery workspace.',
  forgot: 'Enter your work email and we’ll send you a password reset link.',
  reset: 'Choose a new password for your bakery account.',
}

export function AuthPages({ mode, onAuthenticated, onNavigate, onPasswordReset }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)
  const token = new URLSearchParams(window.location.search).get('token') || ''
  const invalid = mode !== 'forgot' && !token
  const submit = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError(null)
    setBusy(true)
    try {
      if (mode === 'forgot') {
        await api.post('/v1/tenant/auth/forgot-password', { email: form.get('email').trim() }, { authenticated: false })
        setSent(true)
      } else {
        const password = form.get('password')
        if (password !== form.get('confirmation')) throw new ApiError('Passwords do not match.', { fieldErrors: { confirmation: 'Enter the same password again.' } })
        if (password.length < 12) throw new ApiError('Use at least 12 characters.', { fieldErrors: { password: 'Use at least 12 characters.' } })
        const name = form.get('name')?.trim()
        const result = await api.post(`/v1/tenant/auth/${mode === 'invite' ? 'accept-invite' : 'reset-password'}`, { token, password, ...(mode === 'invite' && name ? { name } : {}) }, { authenticated: false })
        if (mode === 'invite') await onAuthenticated(result)
        else onPasswordReset()
      }
    } catch (err) {
      setError(err.status === 400 ? new ApiError(mode === 'invite' ? 'This invitation is invalid or has expired. Ask the person who invited you to send a new one.' : 'This reset link is invalid or has expired. Request a new password reset link.') : err)
    } finally { setBusy(false) }
  }
  return <AuthLayout>
    <form className="login-card" onSubmit={submit} aria-busy={busy}>
      <header className="login-heading"><h1 id="login-title">{sent ? 'Check your email' : titles[mode]}</h1><p>{sent ? 'If that email has an account, a reset link is on its way.' : descriptions[mode]}</p></header>
      <ErrorMessage error={invalid ? 'This link is missing its token. Use the full link from your email.' : error} />
      {!sent && <>
        <fieldset className="login-fields" disabled={busy || invalid}>
          <legend className="sr-only">{titles[mode]}</legend>
          {mode === 'forgot' ? <Field label="Email address" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required placeholder="you@yourbakery.com" errors={error?.fieldErrors} /> : <>
            {mode === 'invite' && <Field label="Name (optional)" name="name" autoComplete="name" placeholder="Your name" errors={error?.fieldErrors} />}
            <PasswordField label="New password" name="password" autoComplete="new-password" minLength={12} errors={error?.fieldErrors} />
            <PasswordField label="Confirm password" name="confirmation" autoComplete="new-password" minLength={12} errors={error?.fieldErrors} />
            <p className="text-xs text-muted">Use at least 12 characters. Avoid common passwords and the name in your email address.</p>
          </>}
        </fieldset>
        <button className="login-submit" disabled={busy || invalid}>{busy ? 'Please wait…' : mode === 'forgot' ? 'Send reset link' : mode === 'invite' ? 'Accept invitation' : 'Reset password'}</button>
      </>}
      <footer className="login-support">
        {mode === 'reset' && <button type="button" className="font-semibold text-brand" disabled={busy} onClick={() => onNavigate('/forgot-password')}>Request a new reset link</button>}
        <button type="button" className="font-semibold text-brand" disabled={busy} onClick={() => onNavigate('/')}>Back to sign in</button>
      </footer>
    </form>
  </AuthLayout>
}
