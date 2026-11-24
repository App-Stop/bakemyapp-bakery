import './skeleton.css'

export function SkeletonBlock({ width = '100%', height = 16, className = '' }) {
  return <span aria-hidden="true" className={`skeleton-block ${className}`} style={{ width, height }} />
}
const line = (width = '100%', height = 16) => <SkeletonBlock width={width} height={height} />
function FormShape({ fields }) {
  return <div className="skeleton-form">{Array.from({ length: fields }, (_, i) => <div className="skeleton-field" key={i}>{line('35%', 10)}{line(i % 2 ? '75%' : '60%', 18)}</div>)}</div>
}
function ListShape({ rows, product = false }) {
  return <div className="skeleton-list">{Array.from({ length: rows }, (_, i) => <div className="skeleton-list-row" key={i}>{product && <SkeletonBlock className="skeleton-photo" width={80} height={80} />}<div className="skeleton-copy">{line(i % 2 ? '60%' : '75%', 18)}{line('90%', 12)}{!product && line('45%', 12)}</div>{line(56, 24)}</div>)}</div>
}
function CardsShape({ rows }) {
  return <div className="skeleton-cards">{Array.from({ length: rows }, (_, i) => <div className="skeleton-card" key={i}>{line('55%', 22)}{line('80%', 12)}<div className="skeleton-metrics">{[0, 1, 2].map((n) => <div key={n}>{line('70%', 12)}{line('90%', 26)}</div>)}</div><div className="skeleton-actions">{line('45%', 40)}{line('45%', 40)}</div></div>)}</div>
}
function TableShape({ rows, columns }) {
  return <div className="skeleton-table">{Array.from({ length: rows + 1 }, (_, row) => <div key={row} className={`skeleton-table-row ${row === 0 ? 'skeleton-table-heading' : ''}`} style={{ '--skeleton-columns': columns }}>{Array.from({ length: columns }, (_, col) => <div key={col}>{line(row === 0 ? '65%' : (row + col) % 2 ? '85%' : '60%', row === 0 ? 10 : 16)}{row > 0 && col === 0 && line('80%', 10)}</div>)}</div>)}</div>
}
function StoreShape() {
  return <div className="skeleton-detail"><div className="skeleton-store-main"><div className="skeleton-logo">{line(100, 16)}{line(100, 100)}{line(80, 12)}</div><FormShape fields={4} /></div><div className="skeleton-actions">{line(68, 68)}{line('55%', 68)}</div>{line('35%', 12)}</div>
}
function HoursShape() {
  return <div>{Array.from({ length: 7 }, (_, i) => <div className="skeleton-hour" key={i}>{line('70%', 14)}<div className="skeleton-actions">{line('45%', 32)}{line('45%', 32)}</div>{line(50, 24)}</div>)}</div>
}
/** Non-interactive layout placeholders. One accessible status describes the whole region. */
export function Skeleton({ variant = 'form', label = 'Loading content', rows = 4, columns = 5, fields = 4 }) {
  if (variant === 'metric') return <span className="skeleton-metric" role="status" aria-label={label} aria-busy="true">{line('75%', 28)}</span>
  return <div className={`skeleton skeleton-view-${variant}`} role="status" aria-label={label} aria-busy="true"><div aria-hidden="true">
    {variant === 'store' ? <StoreShape />
      : variant === 'hours' ? <HoursShape />
      : variant === 'table' ? <TableShape rows={rows} columns={columns} />
      : variant === 'cards' ? <CardsShape rows={rows} />
      : variant === 'list' || variant === 'products' || variant === 'toggles' ? <ListShape rows={rows} product={variant === 'products'} />
      : variant === 'detail' ? <div className="skeleton-detail">{line('60%', 24)}{line('85%', 14)}<FormShape fields={4} /><ListShape rows={3} />{line('100%', 42)}</div>
      : variant === 'session' ? <div className="skeleton-app"><aside>{line('80%', 36)}<ListShape rows={7} /></aside><main><div className="skeleton-page-heading">{line('40%', 30)}{line('65%', 14)}</div><CardsShape rows={3} /><div className="skeleton-card"><TableShape rows={6} columns={5} /></div></main></div>
      : <FormShape fields={fields} />}
  </div></div>
}
/** Use inside an existing table body so headers and column widths stay in place. */
export function SkeletonRows({ columns, rows = 6, label = 'Loading rows' }) {
  return Array.from({ length: rows }, (_, row) => <tr key={row} className="skeleton-native-row">{Array.from({ length: columns }, (_, col) => <td key={col}>{row === 0 && col === 0 && <span className="sr-only" role="status">{label}</span>}<SkeletonBlock width={col % 2 ? '80%' : '65%'} />{col === 1 && <SkeletonBlock width="90%" height={10} />}</td>)}</tr>)
}
