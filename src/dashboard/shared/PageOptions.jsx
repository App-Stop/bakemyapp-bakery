import { useId, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, RefreshIcon } from '@hugeicons/core-free-icons'
import './page-options.css'

export function PageOptions({ title, description, icon, badge, actions, children, collapsible = true, toggleLabel = 'page options', toggleText = 'options' }) {
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  return <section className="page-options" aria-labelledby={`${id}-title`}>
    <header className="page-options-header">
      <div className="page-options-heading">
        {icon && <span className="page-options-icon"><HugeiconsIcon icon={icon} size={21} aria-hidden="true" /></span>}
        <div><div className="page-options-title"><h2 id={`${id}-title`}>{title}</h2>{badge && <span className="page-options-badge">{badge}</span>}</div><p>{description}</p></div>
      </div>
      <div className="page-options-actions">
        {actions}
        {children && collapsible && <button type="button" className="page-options-button page-options-expand" aria-label={`${expanded ? 'Hide' : 'Show'} ${toggleLabel}`} aria-expanded={expanded} aria-controls={`${id}-content`} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Hide' : 'Show'} {toggleText}<HugeiconsIcon icon={ArrowDown01Icon} size={16} className={expanded ? 'page-options-chevron-open' : ''} aria-hidden="true" />
        </button>}
      </div>
    </header>
    {children && <div className="page-options-body" id={`${id}-content`} hidden={collapsible && !expanded}>{children}</div>}
  </section>
}

export function RefreshButton({ label, onClick, refreshing, disabled }) {
  return <button type="button" className="page-options-button" disabled={disabled || refreshing} onClick={onClick}>
    <HugeiconsIcon icon={RefreshIcon} size={16} aria-hidden="true" />{refreshing ? 'Refreshing…' : label}
  </button>
}
