import { useState, useId } from 'react'
import { tenant } from '../../lib/tenant'
import { useRemote } from '../../lib/useRemote'
import { useTenant } from '../../lib/TenantContext'
import { ErrorMessage, buttonClass } from '../shared/ApiUI'
import { Skeleton } from '../shared/Skeleton'
import { analyticsPresentation, reportDates, breakdown } from './reporting'

const TIME_RANGES = [{ id: '7D', label: '7D' }, { id: '30D', label: '30D' }, { id: '90D', label: '90D' }, { id: '1Y', label: '1Y' }, { id: 'LIFETIME', label: 'LIFETIME' }]

// Generate smooth cubic bezier SVG path from points
function generateSmoothPath(points) {
  if (!points || points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  let path = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1]

    // Catmull-Rom to Cubic Bezier conversion
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = Math.max(15, Math.min(175, p1.y + (p2.y - p0.y) / 6))
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = Math.max(15, Math.min(175, p2.y - (p3.y - p1.y) / 6))

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return path
}

export function AnalyticsView() {
  const [activeRange, setActiveRange] = useState('30D')
  const [hoveredPointIndex, setHoveredPointIndex] = useState(null)
  const filterId = useId()

  const { branding } = useTenant()
  const [branchId, setBranchId] = useState('')
  const [groupBy, setGroupBy] = useState('')
  const [breakdownKind, setBreakdownKind] = useState('byBranch')
  const store = useRemote(() => tenant.get('store'), [])
  const branches = useRemote(() => tenant.get('branches'), [])
  const timezone = store.data?.data?.timezone
  const params = { ...reportDates(activeRange.toLowerCase(), timezone || 'Asia/Karachi'), branchId }
  if (groupBy) params.groupBy = groupBy
  const requestKey = JSON.stringify(params)
  const report = useRemote(() => timezone ? tenant.list('analytics', params).then((result) => ({ ...result, requestKey })) : Promise.resolve(null), [timezone, requestKey])
  const data = report.data?.requestKey === requestKey ? report.data.data : null
  const currentData = analyticsPresentation(data, store.data?.data?.currencySymbol || branding?.currencySymbol)
  const breakdowns = { byBranch: 'Branch', byFulfilment: 'Fulfilment', byPaymentMethod: 'Payment Method', byStatus: 'Order Status', promos: 'Promo Code' }
  currentData.categories = breakdown((data?.[breakdownKind] || []).map((row) => breakdownKind === 'promos' ? { ...row, name: row.code } : row), { byFulfilment: 'fulfilment', byPaymentMethod: 'paymentMethod', byStatus: 'status' }[breakdownKind] || 'branch')
  const Y_AXIS_TICKS = currentData.ticks
  const pointsWithCoords = currentData.chartPoints
  const error = store.error || branches.error || report.error
  const loading = !data && (store.loading || report.loading)

  const activeIndex =
    hoveredPointIndex !== null ? hoveredPointIndex : currentData.defaultHighlightIndex
  const activePoint = pointsWithCoords[activeIndex] || pointsWithCoords[pointsWithCoords.length - 1]

  const smoothLinePath = generateSmoothPath(pointsWithCoords)

  return (
    <div className="mx-auto flex w-full max-w-[1440px] 2xl:max-w-[1600px] flex-col gap-6 lg:gap-7 xl:gap-8 transition-all">
      {/* Header Row: Title & Time Range Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-[26px] lg:text-[28px] font-semibold tracking-tight text-ink">
            Analytics Overview
          </h1>
          <p className="text-xs sm:text-sm text-muted">
            Revenue trends, product performance, and customer insights.
          </p>
        </div>

        {/* Time Filter Pills */}
        <div className="flex items-center rounded-full border border-[#dcdcdc] bg-[#e8e8e8] p-1 self-start sm:self-auto shadow-xs max-sm:w-full max-sm:rounded-[10px]">
          {TIME_RANGES.map((range) => {
            const isSelected = activeRange === range.id
            return (
              <button
                key={range.id}
                disabled={range.id === 'LIFETIME'}
                title={range.id === 'LIFETIME' ? 'Reports support up to 366 days. Choose 1Y or a shorter period.' : undefined}
                type="button"
                onClick={() => {
                  setActiveRange(range.id)
                  setHoveredPointIndex(null)
                }}
                className={`rounded-full px-3.5 sm:px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 max-sm:flex-1 max-sm:rounded-[6px] max-sm:px-1 max-sm:text-[13px] ${
                  isSelected
                    ? 'bg-white text-ink shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {range.label}
              </button>
            )
          })}
        </div>
      </div>

      {error && <div><ErrorMessage error={error} /><button className={buttonClass} onClick={() => { store.refresh(); branches.refresh(); report.refresh() }}>Retry analytics</button></div>}
      {/* Highlights Row (4 Cards) */}
      <div className="dash-stats grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-5">
        {currentData.highlights.map((item, index) => (
          <div
            key={index}
            className="flex flex-col justify-between rounded-[20px] bg-white p-5 lg:p-6 shadow-[0px_4px_10px_rgba(0,0,0,0.02)] border border-[#f0ece9] min-h-[120px] xl:min-h-[127px] transition-shadow hover:shadow-md"
          >
            <p className="text-sm font-medium text-muted">{item.label}</p>
            <div className="my-1.5">
              <span
                className={`text-2xl lg:text-[28px] font-semibold tracking-tight ${
                  item.isPositive ? 'text-[#39ab00]' : 'text-ink'
                }`}
              >
                {loading ? <Skeleton variant="metric" label={'Loading ' + item.label} /> : item.value}
              </span>
            </div>
            <p className="text-xs text-muted">{item.subtext}</p>
          </div>
        ))}
      </div>

      {/* Daily Revenue Trend Chart Card */}
      <div className="rounded-[20px] bg-white p-5 sm:p-6 lg:p-7 shadow-[0px_4px_10px_rgba(0,0,0,0.02)] border border-[#f0ece9]">
        <div className="mb-6 flex flex-col gap-1">
          <h2 className="text-lg lg:text-xl font-semibold text-ink">Sales Trend</h2>
          <p className="text-xs sm:text-sm text-muted">{currentData.subtitle}</p>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted"><label>Branch <select aria-label="Analytics branch" value={branchId} onChange={(event) => { setBranchId(event.target.value); setHoveredPointIndex(null) }} className="rounded-lg border border-[#dcdcdc] bg-white px-2 py-1"><option value="">All branches</option>{branches.data?.data?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label>Group by <select aria-label="Analytics grouping" value={groupBy} onChange={(event) => { setGroupBy(event.target.value); setHoveredPointIndex(null) }} className="rounded-lg border border-[#dcdcdc] bg-white px-2 py-1"><option value="">Automatic</option><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label></div>
        </div>

        {loading && <p role="status" className="text-sm text-muted">Loading sales chart...</p>}
        {!loading && !error && !pointsWithCoords.length && <p className="text-sm text-muted">No chart data in this period.</p>}
        {/* Chart Canvas */}
        <div className="relative flex w-full pt-4 pb-2">
          {/* Y-Axis Labels */}
          <div className="relative flex flex-col justify-between w-12 sm:w-14 shrink-0 h-[175px] text-[11px] sm:text-xs font-normal text-muted select-none text-right pr-2 sm:pr-3">
            {Y_AXIS_TICKS.map((tick, i) => (
              <span key={i} className="leading-none whitespace-nowrap transform -translate-y-1/2">
                {tick.label}
              </span>
            ))}
          </div>

          {/* SVG Chart & Grid Area */}
          <div className="relative flex-1 h-[175px]">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 1020 190"
              preserveAspectRatio="none"
            >
              <defs>
                <filter id={`shadow-${filterId}`} x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.15" />
                </filter>
              </defs>

              {/* Horizontal Gridlines */}
              {Y_AXIS_TICKS.map((tick, i) => (
                <line
                  key={i}
                  x1="0"
                  y1={tick.y}
                  x2="1020"
                  y2={tick.y}
                  stroke="#e8e8e8"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              ))}

              {/* Revenue Trend Line */}
              <path
                d={smoothLinePath}
                fill="none"
                stroke="var(--brand, #c15400)"
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* Interactive Data Dots (Rendered in HTML for 100% round circles on all desktop screen ratios) */}
            {pointsWithCoords.map((pt, i) => {
              const isSelected = i === activeIndex
              const leftPct = (pt.x / 1020) * 100
              const topPct = (pt.y / 190) * 100
              return (
                <div
                  key={i}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 flex items-center justify-center select-none"
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: '32px',
                    height: '32px',
                  }}
                  onMouseEnter={() => setHoveredPointIndex(i)}
                  onMouseLeave={() => setHoveredPointIndex(null)}
                >
                  {/* Active Point Outer Ring */}
                  {isSelected && (
                    <span
                      className="absolute rounded-full pointer-events-none shadow-xs"
                      style={{
                        width: '16px',
                        height: '16px',
                        border: '2.5px solid var(--brand, #c15400)',
                        backgroundColor: 'white',
                      }}
                    />
                  )}

                  {/* Core Point Dot */}
                  <span
                    className="rounded-full transition-transform duration-150 pointer-events-none"
                    style={{
                      width: isSelected ? '7px' : '9px',
                      height: isSelected ? '7px' : '9px',
                      backgroundColor: isSelected ? 'var(--brand, #c15400)' : 'white',
                      border: isSelected ? 'none' : '2.5px solid var(--brand, #c15400)',
                    }}
                  />
                </div>
              )
            })}

            {/* Dynamic Floating Tooltip */}
            {activePoint && (() => {
              const xPct = (activePoint.x / 1020) * 100
              const yPct = (activePoint.y / 190) * 100
              const translateX = xPct > 85 ? -82 : xPct < 15 ? -18 : -50
              const caretLeft = xPct > 85 ? '82%' : xPct < 15 ? '18%' : '50%'
              return (
                <div
                  className="pointer-events-none absolute z-20 transition-all duration-150 ease-out"
                  style={{
                    left: `${xPct}%`,
                    top: `${yPct}%`,
                    transform: `translate(${translateX}%, -125%)`,
                  }}
                >
                  <div className="relative flex flex-col items-center rounded-xl bg-[#111111] px-3.5 py-2 text-center shadow-xl">
                    <span className="text-[10px] sm:text-[11px] font-normal text-neutral-300 whitespace-nowrap">
                      {activePoint.date}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-white whitespace-nowrap">
                      {activePoint.valStr}
                    </span>
                    {/* Subtle Downward Caret */}
                    <div
                      className="absolute top-full border-4 border-transparent border-t-[#111111]"
                      style={{ left: caretLeft, transform: 'translateX(-50%)' }}
                    />
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Lower Row: Top Selling Products (Left) & Category Breakdown (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 xl:gap-7 items-start">
        {/* Top Selling Products Card (~58% / col-span-7) */}
        <div className="lg:col-span-7 rounded-[20px] bg-white p-5 sm:p-6 lg:p-7 shadow-[0px_4px_10px_rgba(0,0,0,0.02)] border border-[#f0ece9]">
          <h2 className="text-lg lg:text-xl font-semibold text-ink mb-4 sm:mb-5">
            Top Selling Products
          </h2>

          {loading && <Skeleton variant="list" label="Loading top products" rows={5} />}
          {!loading && !error && !currentData.topProducts.length && <p className="text-sm text-muted">No sales in this period.</p>}
          <div className="flex flex-col divide-y divide-[#f5f5f5]">
            {currentData.topProducts.map((prod, idx) => {
              const isFirst = prod.rank === '#1'
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between py-3.5 sm:py-4 px-2 -mx-2 rounded-xl transition-colors hover:bg-neutral-50/80"
                >
                  {/* Rank & Product Title */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-3">
                    <span
                      className={`text-sm sm:text-base font-bold shrink-0 w-7 ${
                        isFirst ? 'text-brand' : 'text-ink'
                      }`}
                    >
                      {prod.rank}
                    </span>
                    <span className="text-xs sm:text-sm font-medium text-ink truncate" title={prod.name}>
                      {prod.name}
                    </span>
                  </div>

                  {/* Units Sold & Total Sales */}
                  <div className="flex items-center gap-4 sm:gap-8 shrink-0 text-right">
                    <span className="text-xs sm:text-sm text-muted whitespace-nowrap w-20 sm:w-24 text-right">
                      {prod.units}
                    </span>
                    <span className="text-xs sm:text-sm lg:text-base font-semibold text-brand whitespace-nowrap w-24 sm:w-28 text-right">
                      {prod.revenue}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Revenue Breakdown by Categories Card (~42% / col-span-5) */}
        <div className="lg:col-span-5 rounded-[20px] bg-white p-5 sm:p-6 lg:p-7 shadow-[0px_4px_10px_rgba(0,0,0,0.02)] border border-[#f0ece9]">
          <h2 className="text-lg lg:text-xl font-semibold text-ink mb-5 sm:mb-6">
            <select aria-label="Analytics breakdown" className="max-w-full bg-transparent font-semibold" value={breakdownKind} onChange={(event) => setBreakdownKind(event.target.value)}>{Object.entries(breakdowns).map(([key, label]) => <option key={key} value={key}>{key === 'byStatus' ? 'Orders' : 'Sales'} by {label}</option>)}</select>
          </h2>

          {!loading && !error && !currentData.categories.length && <p className="text-sm text-muted">No data in this period.</p>}
          {/* Segmented Horizontal Progress Bar */}
          <div className="flex h-7 w-full overflow-hidden rounded-xl gap-1 bg-[#f5f5f5] p-0.5">
            {currentData.categories.map((cat, idx) => (
              <div
                key={idx}
                className="h-full rounded-lg transition-all duration-300 hover:opacity-90 relative group"
                style={{
                  width: `${cat.percent}%`,
                  backgroundColor: cat.color,
                }}
                title={`${cat.name}: ${cat.percent}%`}
              />
            ))}
          </div>

          {/* Legend Items List */}
          <div className="mt-6 flex flex-col gap-3.5 sm:gap-4">
            {currentData.categories.map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center gap-2.5">
                  <span
                    className="size-3 rounded-[3px] shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="font-normal text-body">{cat.name}</span>
                </div>
                <span className="font-semibold text-ink">{cat.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
