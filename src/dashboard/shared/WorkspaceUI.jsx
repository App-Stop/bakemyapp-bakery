import { ErrorMessage, buttonClass } from './ApiUI'
import { Skeleton } from './Skeleton'
import './workspace.css'

export function WorkspaceHeader({ title, description, actions }) {
  return <header className="workspace-header"><div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="workspace-actions">{actions}</div>}</header>
}
export function WorkspaceTabs({ label, options, value, onChange }) {
  return <div className="workspace-tabs" role="group" aria-label={label}>{options.map(([key, title]) => <button type="button" key={key} aria-pressed={value === key} onClick={() => onChange(key)}>{title}</button>)}</div>
}
export function RemoteState({ remote, label, empty, children }) {
  if (remote.loading && !remote.data) return <Skeleton variant="list" label={`Loading ${label}`} rows={4} />
  if (remote.error) return <div className="workspace-stack"><ErrorMessage error={remote.error} /><button type="button" className={`${buttonClass} self-start`} onClick={remote.refresh}>Retry {label}</button></div>
  return empty ? <p className="workspace-empty">No {label} yet.</p> : children
}
export function Textarea({ label, name, errors = {}, ...props }) {
  return <label className="workspace-field"><span>{label}</span><textarea name={name} aria-invalid={!!errors[name]} {...props} />{errors[name] && <small role="alert">{errors[name]}</small>}</label>
}
