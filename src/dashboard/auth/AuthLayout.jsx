import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ViewIcon } from '@hugeicons/core-free-icons'
import { Field } from '../shared/ApiUI'
import '../sign-in.css'

export function AuthLayout({ children }) {
  return <main className="login-page">
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

      <section className="login-area" aria-labelledby="login-title">{children}</section>
    </main>
}

export function PasswordField({ label = 'Password', name = 'password', errors, autoComplete = 'current-password', ...props }) {
  const [visible, setVisible] = useState(false)
  return <Field label={label} name={name} errors={errors}><div className="login-password"><input name={name} type={visible ? 'text' : 'password'} autoComplete={autoComplete} placeholder={label} aria-invalid={!!errors?.[name]} required {...props} /><button type="button" className="login-visibility" aria-label={visible ? 'Hide ' + label.toLowerCase() : 'Show ' + label.toLowerCase()} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <HugeiconsIcon icon={ViewIcon} size={20} aria-hidden="true" /> : <img src="/figma/login/eye-off.svg" alt="" width={20} height={20} />}</button></div></Field>
}
