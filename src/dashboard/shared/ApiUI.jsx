import { useEffect } from 'react'

export const buttonClass = 'rounded-full border border-[#e8e8e8] bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-50'
export const primaryClass = `${buttonClass} !border-transparent !bg-brand !text-on-brand`
export const cardClass = 'rounded-[20px] border border-[#f0ece9] bg-white p-5 sm:p-6'

export function ErrorMessage({ error }) {
  return error ? <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700"><p>{typeof error === 'string' ? error : error.message}</p>{error.fieldErrors && <ul className="mt-1 list-inside list-disc">{Object.entries(error.fieldErrors).map(([field, message]) => <li key={field}>{field}: {message}</li>)}</ul>}</div> : null
}
export function Field({ label, name, errors = {}, children, ...props }) {
  return <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-body"><span>{label}</span>{children || <input name={name} {...props} aria-invalid={!!errors[name]} className="w-full rounded-xl border border-[#e8e8e8] bg-white p-3 text-ink outline-none focus:border-brand disabled:bg-gray-100" />}{errors[name] && <span className="text-xs text-red-700">{errors[name]}</span>}</label>
}
export function Modal({ title, children, onClose, busy = false, description, className = '' }) {
  useEffect(() => {
    const keydown = (event) => { if (event.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [busy, onClose])
  return <div className="dash-sheet-backdrop fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4" onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}><section role="dialog" aria-modal="true" aria-label={title} className={`dash-sheet my-auto flex max-h-[92vh] w-full max-w-xl flex-col gap-5 overflow-y-auto rounded-[20px] bg-white p-6 ${className}`}><div className="modal-heading flex items-center justify-between gap-4"><div><h2 className="text-xl font-semibold">{title}</h2>{description && <p className="mt-1.5 text-sm font-normal text-muted">{description}</p>}</div><button type="button" disabled={busy} onClick={onClose} aria-label="Close dialog" className={buttonClass}>×</button></div>{children}</section></div>
}
export function Pagination({ pagination, page, onChange, disabled }) {
  if (!pagination) return null
  return <div className="flex items-center justify-end gap-3 text-sm"><span>{pagination.totalItems} results · Page {page} of {pagination.totalPages || 1}</span><button className={buttonClass} disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>Previous</button><button className={buttonClass} disabled={disabled || page >= (pagination.totalPages || 1)} onClick={() => onChange(page + 1)}>Next</button></div>
}
