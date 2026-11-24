import { Skeleton } from '../shared/Skeleton'
import { useRef, useState } from 'react'
import { tenant, can, changes } from '../../lib/tenant'
import { api } from '../../lib/api'
import { extractPalette, readableTextOn } from '../../lib/color'
import { useTenant } from '../../lib/TenantContext'
import { useRemote } from '../../lib/useRemote'
import { ErrorMessage, Field as ApiField, buttonClass } from '../shared/ApiUI'
import { SettingsToggle } from './SettingsToggle'
import { storeForm, storePatch, orderForm, orderPatch, week, hoursBody, validateLogo } from './settingsHelpers'
import '../shared/modules.css'
import './settings.css'
import { useSettingsNavigation } from './useSettingsNavigation'
import { CatalogModal } from '../shared/CatalogUI'
import { HugeiconsIcon } from '@hugeicons/react'
import { CroissantIcon } from '@hugeicons/core-free-icons'

const identity = (data) => data
function useSection(path, allowed, transform = identity) {
  const remote = useRemote(() => allowed ? tenant.get(path) : Promise.resolve(null), [path, allowed])
  const [seen, setSeen] = useState(null)
  const [base, setBase] = useState(null)
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState(null)
  if (remote.data && remote.data !== seen) { setSeen(remote.data); setBase(remote.data.data); setDraft(transform(remote.data.data)) }
  return { ...remote, base, draft, setDraft, error: error || remote.error, setError, accept: (data) => { setBase(data); setDraft(transform(data)); setError(null) } }
}
const notificationLabels = { newOrderAlerts: 'New order alerts', orderStatusUpdates: 'Order status updates', lowStockWarnings: 'Low stock warnings', dailySalesSummary: 'Daily sales summary', weeklyAnalyticsReport: 'Weekly analytics report', customerReviews: 'Customer reviews' }
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export function SettingsView() {
  const { user, updateStore } = useTenant()
  const storeAllowed = can(user, 'business:view') && can(user, 'branding:view')
  const editStore = can(user, 'business:edit') && can(user, 'branding:edit')
  const owner = user.role === 'tenant_owner' && can(user, 'payments:manage')
  const store = useSection('store', storeAllowed, storeForm)
  const hours = useSection('hours', can(user, 'branches:view'))
  const orders = useSection('order-settings', owner, orderForm)
  const notices = useSection('notification-preferences', true)
  const presets = useRemote(() => storeAllowed ? tenant.get('branding/presets') : Promise.resolve(null), [storeAllowed])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmation: '' })
  const [passwordError, setPasswordError] = useState(null)
  const [branchId, setBranchId] = useState('')
  const [hoursDraft, setHoursDraft] = useState(null)
  const [hoursOriginal, setHoursOriginal] = useState(null)
  const [moreColors, setMoreColors] = useState(false)
  const [colorEditor, setColorEditor] = useState(false)
  const logoInput = useRef(null)
  const sections = [...(storeAllowed ? [['store-info', 'Store Information']] : []), ...(can(user, 'branches:view') ? [['business-hours', 'Business Hours']] : []), ...(owner ? [['order-settings', 'Order Settings']] : []), ['notifications', 'Notifications'], ['account-security', 'Account & Security']]
  const { rootRef, asideRef, navRef, active, navigate } = useSettingsNavigation(sections.map(([id]) => id))
  const [logoBusy, setLogoBusy] = useState(false)
  const [logoColors, setLogoColors] = useState([])
  const setField = (section, key, value) => { section.setDraft((draft) => ({ ...draft, [key]: value })); setMessage('') }
  const input = (section, key, label, props = {}) => <Field label={label} name={key} value={section.draft[key] ?? ''} errors={section.error?.fieldErrors} onChange={(e) => setField(section, key, e.target.value)} {...props} />
  const toggle = (section, key, label, description) => <div key={key} className="settings-toggle-row"><div><strong>{label}</strong>{description && <small>{description}</small>}</div><SettingsToggle checked={!!section.draft[key]} ariaLabel={label} onChange={(value) => setField(section, key, value)} /></div>
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setMessage('')
    let failed = [store, hours, orders, notices].some((section) => section.error && !section.base)
    let saved = false
    const run = async (section, action) => { section.setError(null); try { await action(); saved = true } catch (error) { section.setError(error); failed = true } }
    if (editStore && store.draft) await run(store, async () => {
      const patch = storePatch(store.base, store.draft)
      if (!/^#[0-9a-f]{6}$/i.test(store.draft.primary)) throw new Error('Use a colour like #C15400.')
      // An unchanged store can still be confirmed for the setup checklist.
      if (Object.keys(patch).length || !store.base.businessConfirmed || !store.base.brandingConfirmed) { const result = await tenant.patch('store', patch); store.accept(result.data); updateStore?.(result.data) }
    })
    if (can(user, 'branches:edit') && hoursDraft) await run(hours, async () => { if (JSON.stringify(hoursDraft) !== JSON.stringify(hoursOriginal)) { const result = await tenant.put('hours', hoursBody(hoursDraft, branchId)); hours.accept(result.data); setHoursOriginal(hoursDraft) } })
    if (owner && orders.draft) await run(orders, async () => { const patch = orderPatch(orders.base, orders.draft); if (Object.keys(patch).length) orders.accept((await tenant.patch('order-settings', patch)).data) })
    if (notices.draft) await run(notices, async () => { const patch = changes(notices.base, notices.draft); if (Object.keys(patch).length) notices.accept((await tenant.patch('notification-preferences', patch)).data) })
    setMessage(failed ? 'Some sections could not be saved. Review the errors below; your other changes were saved.' : saved ? 'Settings saved.' : 'No changes to save.'); setBusy(false)
  }
  const logo = async (file, remove = false) => {
    setLogoBusy(true); store.setError(null); setMessage('')
    try { if (!remove) { await validateLogo(file); const localUrl = URL.createObjectURL(file); try { setLogoColors(await extractPalette(localUrl)) } finally { URL.revokeObjectURL(localUrl) } } else setLogoColors([]); const result = remove ? await tenant.delete('store/logo') : await tenant.post('store/logo', file)
      // A logo operation must not discard pending edits to store fields.
      const draft = store.draft; store.accept(result.data); store.setDraft(draft); updateStore?.(result.data); setMessage('Logo saved.')
    } catch (error) { store.setError(error) } finally { setLogoBusy(false) }
  }
  const changePassword = async () => {
    setBusy(true); setPasswordError(null); setMessage('')
    try { if (password.newPassword !== password.confirmation) throw new Error('Passwords do not match.'); if (password.newPassword.length < 12) throw new Error('Use at least 12 characters.'); const result = await tenant.post('me/change-password', { currentPassword: password.currentPassword, newPassword: password.newPassword }); api.setToken(result.data.accessToken); setPassword({ currentPassword: '', newPassword: '', confirmation: '' }); setMessage('Password changed. Your other devices have been signed out.') } catch (error) { setPasswordError(error) } finally { setBusy(false) }
  }
  const selectedWeek = hoursDraft || (hours.base?.sameForAll ? week(hours.base.hours) : null)
  const selectBranch = (id) => { setBranchId(id); const source = id ? hours.base.branches.find((b) => b.id === id)?.hours : hours.base.hours || []; setHoursDraft(week(source)); setHoursOriginal(id || hours.base.sameForAll ? week(source) : null) }
  return <form ref={rootRef} onSubmit={save} className="settings-page">
    <header className="settings-header"><div><h1>Store Settings</h1><p>Configure your store information, business hours, order limits, and notifications.</p></div><button className="settings-save" disabled={busy || logoBusy}>{busy ? 'Saving…' : 'Save Changes'}</button></header>
    {message && <p role="status" className="catalog-notice">{message}</p>}
    <div className="settings-layout">
      <aside ref={asideRef} className="settings-sidebar"><nav ref={navRef} aria-label="Settings sections">{sections.map(([id, label]) => <button type="button" data-section={id} key={id} aria-current={active === id ? 'true' : undefined} onClick={() => navigate(id)}>{label}</button>)}</nav></aside>
      <div className="settings-content">
        {storeAllowed && <SettingsSection id="store-info" title="Store Information" description="Update your public store details and contact credentials." section={store}>
          {store.draft && <fieldset disabled={!editStore || busy || logoBusy} className="settings-fields">
            {!editStore && <p className="settings-hint">Only the owner can change store information.</p>}
            <div className="settings-store-main">
              <div className="settings-logo"><span>Bakery Logo</span><div className="settings-logo-preview">{store.base.logo?.url ? <img src={store.base.logo.url} alt="Bakery logo" /> : <HugeiconsIcon icon={CroissantIcon} size={40} />}</div><input ref={logoInput} type="file" className="hidden" aria-label="Upload bakery logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => { if (e.target.files?.[0]) logo(e.target.files[0]); e.target.value = '' }} /><button type="button" className="settings-text-button" onClick={() => logoInput.current?.click()}>{logoBusy ? 'Updating…' : 'Change Logo'}</button>{store.base.logo && <button type="button" className="settings-text-button" onClick={() => logo(null, true)}>Remove logo</button>}<small className="settings-hint">512 × 512 recommended</small></div>
              <div className="module-grid">{input(store, 'name', 'Bakery Name', { required: true })}{input(store, 'contactEmail', 'Email Address', { type: 'email' })}{input(store, 'address', 'Physical Address', { maxLength: 300 })}{input(store, 'contactPhone', 'Phone Number', { type: 'tel' })}</div>
            </div>
            <div className="settings-brand"><span>Brand color</span><div className="settings-brand-row"><button type="button" aria-label="Current brand color swatch" className="settings-color-swatch" style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(store.draft.primary) ? store.draft.primary : '#555' }} onClick={() => setColorEditor(true)} /><Field label="Custom Color" name="primary" errors={store.error?.fieldErrors} pattern="#[0-9a-fA-F]{6}" value={store.draft.primary} onChange={(e) => store.setDraft((d) => ({ ...d, preset: 'custom', primary: e.target.value.toUpperCase() }))} /><button type="button" className="settings-secondary" onClick={() => setColorEditor(true)}>Change</button></div></div>
            <details className="settings-advanced"><summary>Additional store details</summary><div className="module-grid">
              <Field label="Time zone" name="timezone" errors={store.error?.fieldErrors}><><input name="timezone" list="store-timezones" value={store.draft.timezone} required onChange={(e) => setField(store, 'timezone', e.target.value)} /><datalist id="store-timezones">{Intl.supportedValuesOf('timeZone').map((zone) => <option key={zone} value={zone} />)}</datalist></></Field>
              {input(store, 'appName', 'App name', { placeholder: store.draft.name })}{input(store, 'currencyCode', 'Currency code', { pattern: '[A-Z]{3}', maxLength: 3, required: true })}{input(store, 'currencySymbol', 'Currency symbol', { maxLength: 8, required: true })}<Field label="Store slug" value={store.base.slug} disabled /><Field label="Status" value={store.base.status} disabled />
            </div><p className="settings-hint mt-3">Ask Bake My App to change your store slug. When changing currency, update the currency symbol too.</p></details>
          </fieldset>}
        </SettingsSection>}
        {can(user, 'branches:view') && <SettingsSection id="business-hours" title="Business Hours" description="Define times when customers can place delivery and pickup orders." section={hours} onReload={() => { setHoursDraft(null); setHoursOriginal(null); setBranchId('') }}>
          {hours.base && <fieldset disabled={busy || !can(user, 'branches:edit')} className="settings-fields">
            {hours.base.branches.length > 1 && <Field label="Apply hours to"><select value={branchId} onChange={(e) => selectBranch(e.target.value)}><option value="">All active branches</option>{hours.base.branches.map((b) => <option key={b.id} value={b.id}>{b.name}{b.isActive ? '' : ' (inactive)'}</option>)}</select></Field>}
            {!selectedWeek && <><p>Branches have different hours. Select a branch or explicitly set a shared week.</p><button type="button" className={buttonClass} onClick={() => selectBranch('')}>Set a shared week</button></>}
            <div>{selectedWeek?.map((day, i) => <div key={day.day}>
              <div className="settings-hour-row"><span className="settings-hour-day">{dayNames[i]}</span><div className="settings-hour-times">{!day.isClosed ? <>{['opensAt', 'closesAt'].map((key, index) => <span key={key} className="contents">{index === 1 && <span>to</span>}<input aria-label={`${dayNames[i]} ${key === 'opensAt' ? 'opens' : 'closes'}`} name={`hours.${i}.${key}`} aria-invalid={!!hours.error?.fieldErrors?.[`hours.${i}.${key}`]} type="time" required value={day[key]} onChange={(e) => { const next = [...selectedWeek]; next[i] = { ...day, [key]: e.target.value }; setHoursDraft(next); if (!hoursOriginal) setHoursOriginal(selectedWeek) }} /></span>)}</> : <span className="settings-closed">--:--</span>}</div><div className="settings-hour-status" data-closed={day.isClosed}><span>{day.isClosed ? 'Closed' : 'Open'}</span><SettingsToggle checked={!day.isClosed} ariaLabel={`${dayNames[i]} open`} onChange={(open) => { const next = [...selectedWeek]; next[i] = { ...day, isClosed: !open }; setHoursDraft(next); if (!hoursOriginal) setHoursOriginal(selectedWeek) }} /></div></div>
              {['opensAt', 'closesAt', 'isClosed', 'day'].map((key) => hours.error?.fieldErrors?.[`hours.${i}.${key}`] && <p key={key} className="settings-hour-errors">{hours.error.fieldErrors[`hours.${i}.${key}`]}</p>)}
            </div>)}</div>
            <p className="settings-hint">Hours use {store.base?.timezone || 'the bakery time zone'}. A shared week replaces hours on every active branch.</p>
          </fieldset>}
        </SettingsSection>}
        {owner && <SettingsSection id="order-settings" title="Order Settings" description="Configure delivery capabilities, kitchen prep estimates, and order limits." section={orders}>{orders.draft && <fieldset disabled={busy} className="settings-fields">
          {toggle(orders, 'acceptDelivery', 'Accept delivery orders', 'Allow customers to request direct delivery.')}{toggle(orders, 'acceptPickup', 'Accept pickup orders', 'Allow quick carryout & store pickups.')}<hr className="settings-divider" />
          <div className="settings-order-grid">{input(orders, 'deliveryMinutes', 'Estimated delivery time (mins)', { type: 'number', min: 1, max: 600 })}{input(orders, 'minimumOrder', `Minimum Order Amount (${store.base?.currencySymbol || 'currency'})`, { type: 'number', min: 0, step: '0.01', placeholder: orders.base.branchesDiffer?.minimumOrder ? 'Varies by branch' : '' })}{input(orders, 'deliveryRadiusKm', 'Delivery Radius (km)', { type: 'number', min: 0, step: 'any', placeholder: orders.base.branchesDiffer?.deliveryRadiusKm ? 'Varies by branch' : 'No limit' })}</div>
          <hr className="settings-divider" /><div className="module-grid">{input(orders, 'taxRate', 'Tax Rate (%)', { type: 'number', min: 0, max: 100, step: 'any' })}<Field label="Tax Label" name="taxLabel" errors={orders.error?.fieldErrors}><select value={orders.draft.taxLabel} onChange={(e) => setField(orders, 'taxLabel', e.target.value)}>{['Tax', 'VAT', 'Sales Tax', 'GST', 'Service Tax'].map((label) => <option key={label}>{label}</option>)}</select></Field></div>
          <p className="settings-hint">Minimum order and delivery radius changes apply to every branch. Empty radius means no limit; untouched values that vary are preserved.</p>
        </fieldset>}</SettingsSection>}
        <SettingsSection id="notifications" title="Notification Preferences" description="Control how and when you receive alerts and updates." section={notices}>{notices.draft && <fieldset disabled={busy} className="settings-notifications">{Object.entries(notificationLabels).map(([key, label]) => toggle(notices, key, label, notificationDescriptions[key]))}<p className="settings-hint mt-4">These preferences are personal to your account. Summary and low-stock emails are not sent yet.</p></fieldset>}</SettingsSection>
        <section id="account-security" className="settings-card"><div className="settings-card-heading"><h2>Account & Security</h2><p>Secure your dashboard login and active sessions.</p></div><ErrorMessage error={passwordError} /><div className="module-grid"><Field label="Login Email" value={user.email || ''} disabled /><div className="settings-hint self-center">Your sign-in email cannot be changed here.</div></div><fieldset disabled={busy} className="module-grid">{[['currentPassword', 'Current password'], ['newPassword', 'New password'], ['confirmation', 'Confirm new password']].map(([key, label]) => <Field key={key} label={label} type="password" autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'} name={key} value={password[key]} errors={passwordError?.fieldErrors} onChange={(e) => setPassword({ ...password, [key]: e.target.value })} />)}</fieldset><p className="settings-hint">Use at least 12 characters, avoid common passwords and your email name.</p><button type="button" className="settings-secondary self-start" disabled={busy || !password.currentPassword || !password.newPassword || !password.confirmation} onClick={changePassword}>Change password</button></section>
      </div>
    </div>
    {colorEditor && store.draft && <CatalogModal title="Brand color" description="Choose a preset or a custom color for your customer app." onClose={() => setColorEditor(false)}><fieldset disabled={!editStore || busy} className="settings-fields"><ErrorMessage error={presets.error} />{presets.loading && <Skeleton variant="list" label="Loading brand colors" rows={3} />}<div className="flex flex-wrap gap-2">{presets.data?.data?.filter((p) => moreColors || p.featured).map((p) => <button key={p.id} type="button" className={buttonClass} aria-pressed={store.draft.preset === p.id} onClick={() => store.setDraft((d) => ({ ...d, preset: p.id, primary: p.primary }))}><span className="mr-2 inline-block size-3 rounded-full" style={{ background: p.primary }} />{p.name}</button>)}<button type="button" className={buttonClass} onClick={() => setMoreColors(!moreColors)}>{moreColors ? 'Fewer colours' : 'More colours'}</button></div>{logoColors.length > 0 && <div><p className="settings-hint mb-2">Colors from your logo</p><div className="flex gap-2">{logoColors.map((primary) => <button type="button" key={primary} className={buttonClass} style={{ background: primary, color: readableTextOn(primary) }} onClick={() => store.setDraft((d) => ({ ...d, preset: 'custom', primary: primary.toUpperCase() }))}>{primary}</button>)}</div></div>}<div className="rounded-xl p-5 font-semibold" style={{ background: /^#[0-9a-f]{6}$/i.test(store.draft.primary) ? store.draft.primary : '#555', color: /^#[0-9a-f]{6}$/i.test(store.draft.primary) ? readableTextOn(store.draft.primary) : '#fff' }}>{store.base.logo?.url && <img src={store.base.logo.url} alt="" className="mb-2 size-10 object-contain" />}{store.draft.appName || store.draft.name}</div><p className="settings-hint">Brand changes reach customer apps within a minute, the next time the app opens. Use Save Changes to apply your selection.</p><button type="button" className="settings-secondary self-end" onClick={() => setColorEditor(false)}>Done</button></fieldset></CatalogModal>}
  </form>
}
function Field(props) {
  return <div className="settings-field"><ApiField {...props} /></div>
}
const notificationDescriptions = {
  newOrderAlerts: 'Play a chime when a new order arrives.',
  orderStatusUpdates: 'Receive updates as orders move through preparation.',
  lowStockWarnings: 'Save your preference for future low-stock alerts.',
  dailySalesSummary: 'Save your preference for daily sales summaries.',
  weeklyAnalyticsReport: 'Save your preference for weekly analytics reports.',
  customerReviews: 'Receive updates about customer feedback.',
}
function SettingsSection({ id, title, description, section, children, onReload }) {
  return <section id={id} className="settings-card"><div className="settings-card-heading"><h2>{title}</h2><p>{description}</p></div><ErrorMessage error={section.error} />{section.loading && <Skeleton variant={id === 'store-info' ? 'store' : id === 'business-hours' ? 'hours' : id === 'notifications' ? 'toggles' : 'form'} label={`Loading ${title}`} rows={id === 'notifications' ? 6 : 7} columns={3} fields={id === 'notifications' ? 6 : 4} />}{section.error && <button type="button" className={`${buttonClass} self-start`} onClick={() => { onReload?.(); section.setError(null); section.refresh() }}>Reload section</button>}{!section.loading && children}</section>
}
