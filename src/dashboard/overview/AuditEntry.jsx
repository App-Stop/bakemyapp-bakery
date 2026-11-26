import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { auditEntry } from './audit'

function AuditValue({ value, previous = false }) {
  return <div className="flex min-w-0 flex-wrap gap-1">
    {value.items.map((item, index) => <span key={index} className={`max-w-full rounded-md px-2 py-1 text-xs leading-relaxed [overflow-wrap:anywhere] ${value.empty ? 'px-0 italic text-muted' : previous ? 'bg-[#f5f5f5] text-muted' : 'bg-brand-light font-medium text-ink'}`}>{item}</span>)}
  </div>
}

export function AuditEntry({ event, symbol }) {
  const entry = auditEntry(event, symbol)
  const date = new Date(event.createdAt)
  const validDate = !Number.isNaN(date.getTime())
  return <article className="min-w-0 py-4 first:pt-0 last:pb-0" data-audit-entry={event.id}>
    <p className="text-sm leading-relaxed text-ink"><span className="font-semibold">{entry.actor}</span> {entry.action}</p>
    <time dateTime={validDate ? event.createdAt : undefined} title={validDate ? `${date.toISOString()} · Asia/Karachi` : undefined} className="mt-1 block text-xs text-muted">
      {validDate ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(date) : 'Time unavailable'}
    </time>
    {!!entry.changes.length && <details className="group mt-2">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded text-xs font-medium text-brand outline-none focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-details-marker]:hidden">
        View {entry.changes.length} {entry.changes.length === 1 ? 'change' : 'changes'}
        <HugeiconsIcon icon={ArrowDown01Icon} size={14} className="transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>
      <div className="mt-3 rounded-xl border border-[#f0ece9] p-3">
        <div aria-hidden="true" className="mb-2 hidden grid-cols-[minmax(0,.9fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-3 text-[11px] font-medium uppercase tracking-wide text-muted sm:grid"><span>Field</span><span>Before</span><span>After</span></div>
        <dl className="divide-y divide-[#f0ece9]">
          {entry.changes.map((change) => <div key={change.key} className="grid grid-cols-2 gap-x-3 gap-y-1.5 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,.9fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
            <dt className="col-span-2 min-w-0 text-xs font-medium leading-relaxed text-body [overflow-wrap:anywhere] sm:col-span-1 sm:pt-1">{change.label}</dt>
            <dd className="min-w-0"><span className="mb-1 block text-[11px] text-muted sm:sr-only">Before</span>{change.hasBefore ? <AuditValue value={change.before} previous /> : <span className="text-xs italic text-muted">Not recorded</span>}</dd>
            <dd className="min-w-0"><span className="mb-1 block text-[11px] text-muted sm:sr-only">After</span><AuditValue value={change.after} /></dd>
          </div>)}
        </dl>
      </div>
    </details>}
  </article>
}
