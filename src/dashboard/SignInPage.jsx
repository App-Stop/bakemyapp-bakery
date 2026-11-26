import { ErrorMessage, Field } from './shared/ApiUI'
import { AuthLayout, PasswordField } from './auth/AuthLayout'

export function SignInPage({ onSubmit, busy, error, message, onForgot }) {

  return (
    <AuthLayout>
        <form className="login-card" onSubmit={onSubmit} aria-busy={busy}>
          <header className="login-heading">
            <h1 id="login-title">Welcome back</h1>
            <p>Sign in with your work credentials. We’ll take you to the right dashboard automatically.</p>
          </header>

          <ErrorMessage error={error} />
          {message && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{message}</p>}

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
            <PasswordField errors={error?.fieldErrors} />
          </fieldset>

          <button type="submit" className="login-submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <footer className="login-support">
            <button type="button" className="font-semibold text-brand" disabled={busy} onClick={onForgot}>Forgot password?</button>
            <p>Contact your administrator or Support</p>
          </footer>
        </form>
    </AuthLayout>
  )
}
