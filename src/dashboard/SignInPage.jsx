import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ViewIcon } from '@hugeicons/core-free-icons'
import { ErrorMessage, Field } from './shared/ApiUI'
import './sign-in.css'

export function SignInPage({ onSubmit, busy, error }) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <main className="login-page">
      <aside className="login-welcome" aria-label="Bake My App">
        <div className="login-glow login-glow-top" aria-hidden="true" />
        <div className="login-glow login-glow-bottom" aria-hidden="true" />

        <div className="login-identity">
          <div className="login-brand-mark" aria-hidden="true">
            <span className="login-croissant" />
          </div>
          <div>
            <p className="login-brand-name">Bake My App</p>
            <p className="login-brand-description">Bakery operations portal</p>
          </div>
        </div>

        <div className="login-welcome-copy">
          <p className="login-eyebrow">Unified operations portal</p>
          <h2>Everything your bakery needs, in one place.</h2>
          <p className="login-welcome-description">
            Manage orders, branches, menus, customers, and performance from a workspace built for every shift.
          </p>
        </div>

        <p className="login-footer">© 2026 Bake My App · Privacy · Security</p>
      </aside>

      <section className="login-area" aria-labelledby="login-title">
        <form className="login-card" onSubmit={onSubmit} aria-busy={busy}>
          <header className="login-heading">
            <h1 id="login-title">Welcome back</h1>
            <p>Sign in with your work credentials. We’ll take you to the right dashboard automatically.</p>
          </header>

          <ErrorMessage error={error} />

          <fieldset className="login-fields" disabled={busy}>
            <legend className="sr-only">Sign in to your bakery</legend>
            <Field
              label="Email address"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="you@yourbakery.com"
              autoCapitalize="none"
              spellCheck={false}
              required
              errors={error?.fieldErrors}
            />
            <Field label="Password" name="password" errors={error?.fieldErrors}>
              <div className="login-password">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  aria-invalid={!!error?.fieldErrors?.password}
                  required
                />
                <button
                  type="button"
                  className="login-visibility"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? (
                    <HugeiconsIcon icon={ViewIcon} size={20} aria-hidden="true" />
                  ) : (
                    <img src="/figma/login/eye-off.svg" alt="" width={20} height={20} />
                  )}
                </button>
              </div>
            </Field>
          </fieldset>

          <button type="submit" className="login-submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <footer className="login-support">
            <p>Need help accessing your account?</p>
            <p>Contact your administrator or Support</p>
          </footer>
        </form>
      </section>
    </main>
  )
}
