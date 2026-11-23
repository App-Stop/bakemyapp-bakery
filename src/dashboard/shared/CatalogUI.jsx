import { useEffect, useRef } from 'react'
import { Modal } from './ApiUI'
import './catalog.css'

export function DesignIcon({ file, className = '', folder = 'catalog' }) {
  return <img src={`/figma/${folder}/${file}.svg`} alt="" aria-hidden="true" className={`design-icon ${className}`} />
}

export function CatalogSearch({ label, placeholder, value, onChange }) {
  return <label className="catalog-search"><DesignIcon file="8a13e" /><input aria-label={label} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} /></label>
}

export function CatalogModal({ title, description, wide, children, className = '', ...props }) {
  const ref = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    const dialog = ref.current?.closest('[role="dialog"]')
    const focusable = () => [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary')].filter((node) => node.getClientRects().length)
    ref.current?.querySelector('input:not(:disabled)')?.focus()
    const trap = (event) => {
      if (event.key !== 'Tab') return
      const nodes = focusable()
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus() }
      else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus() }
    }
    dialog?.addEventListener('keydown', trap)
    return () => { dialog?.removeEventListener('keydown', trap); previous?.focus() }
  }, [])
  return <Modal {...props} title={title} description={description} className={`catalog-modal ${wide ? 'catalog-modal-wide' : ''} ${className}`}><div ref={ref}>{children}</div></Modal>
}

export function CatalogField({ label, name, errors = {}, children, ...props }) {
  return <label className="catalog-field"><span>{label}</span>{children || <input name={name} aria-invalid={!!errors[name]} {...props} />}{errors[name] && <small role="alert">{errors[name]}</small>}</label>
}

export function CatalogPagination({ pagination, page, count, noun = 'items', onChange, disabled }) {
  if (!pagination || !pagination.totalItems) return null
  const size = pagination.itemsPerPage || 8
  return <div className="catalog-pagination"><p>Showing {(page - 1) * size + 1}–{(page - 1) * size + count} of {pagination.totalItems} {noun}</p><div><button disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>Previous</button><button disabled={disabled || page >= (pagination.totalPages || 1)} onClick={() => onChange(page + 1)}>Next</button></div></div>
}
