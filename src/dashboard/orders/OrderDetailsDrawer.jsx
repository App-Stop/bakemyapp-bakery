import { useEffect, useRef } from 'react'
import { dateTime, money, tenant } from '../../lib/tenant'
import { useRemote } from '../../lib/useRemote'
import { ErrorMessage } from '../shared/ApiUI'
import { DesignIcon } from '../shared/CatalogUI'
import { statusLabels } from './orderHelpers'

const clock = (date) => date ? new Date(date).toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour: 'numeric', minute: '2-digit' }) : '—'

export function OrderDetailsDrawer({ id, revision, onClose, renderActions }) {
  const ref = useRef(null)
  const detail = useRemote(() => tenant.get(`orders/${id}`), [id, revision], { poll: 20000 })
  const order = detail.data?.data?.id === id ? detail.data.data : null
  useEffect(() => {
    const previous = document.activeElement
    ref.current?.querySelector('button')?.focus()
    const keydown = (event) => {
      if (document.querySelector('.dash-sheet-backdrop')) return
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') {
        const nodes = [...ref.current.querySelectorAll('button:not(:disabled), a[href]')]
        if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus() }
        else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus() }
      }
    }
    window.addEventListener('keydown', keydown)
    return () => { window.removeEventListener('keydown', keydown); previous?.focus() }
  }, [onClose])
  const stages = order ? [['placed', 'Received'], ['accepted', 'Accepted'], ['preparing', 'Preparing'], ['ready', 'Ready'], ...(order.fulfilment === 'delivery' ? [['out_for_delivery', 'Dispatch']] : []), ['completed', order.fulfilment === 'delivery' ? 'Delivered' : 'Collected'], ...(order.status === 'cancelled' ? [['cancelled', 'Cancelled']] : [])] : []
  const visibleStages = stages.filter(([status]) => status !== 'accepted' || order.status === 'accepted' || order.events?.some((event) => event.to === 'accepted'))
  const currentIndex = visibleStages.findIndex(([status]) => status === order?.status)
  return <div className="order-panel-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}><aside ref={ref} role="dialog" aria-modal="true" aria-label="Order details" className="order-detail-panel">
    <header><div><h2>Order {order ? `#${order.number}` : ''}</h2>{order && <p>Received at {clock(order.placedAt)}</p>}</div><button aria-label="Close order details" onClick={onClose}><DesignIcon file={order?.status === 'completed' ? '9f539' : 'dcdbe'} /></button></header>
    <ErrorMessage error={detail.error} />{detail.loading && !order && <p role="status">Loading order…</p>}
    {order && !detail.error && <>
      <section className="order-delivery"><h3>{order.fulfilment === 'delivery' ? 'Delivery' : 'Pickup'} Details</h3><strong>{order.address?.recipientName || order.customer?.name}</strong>{(order.address?.phone || order.customer?.phone) && <a href={`tel:${order.address?.phone || order.customer.phone}`}>{order.address?.phone || order.customer.phone}</a>}{order.address ? <p>{[order.address.addressLine1, order.address.addressLine2, order.address.area, order.address.city].filter(Boolean).join(', ')}</p> : <p>{order.branch?.name}</p>}{order.address?.instructions && <p>Rider instructions: {order.address.instructions}</p>}{order.notes && <p>Customer notes: {order.notes}</p>}{order.rider && <p>Rider: {order.rider.name}</p>}</section>
      <section className="order-detail-items"><h3>Items</h3>{order.items?.map((item) => <div key={item.id}><div className="order-detail-line"><span>{item.quantity}x {item.productName}{item.sizeName && ` · ${item.sizeName}`}</span><span>{money(item.lineTotal, order.currencySymbol)}</span></div>{item.addons?.map((addon, index) => <p key={index} className="order-detail-note">{addon.setName}: {addon.optionName} (+{money(addon.price, order.currencySymbol)})</p>)}{item.note && <p className="order-detail-note">Note: {item.note}</p>}</div>)}</section>
      <div className="catalog-asset-divider"><DesignIcon file="a824b" /></div><section className="order-detail-totals"><div><span>Subtotal</span><span>{money(order.subtotal, order.currencySymbol)}</span></div><div><span>Delivery Fee</span><span>{money(order.deliveryFee, order.currencySymbol)}</span></div>{order.tax != null && <div><span>Tax</span><span>{money(order.tax, order.currencySymbol)}</span></div>}<div className="order-detail-grand-total"><strong>Total</strong><strong>{money(order.total, order.currencySymbol)} ({order.paymentMethod === 'cod' ? 'Cash' : 'Card'})</strong></div>{order.payment?.reference && <p className="order-detail-note break-all">Stripe reference: {order.payment.reference}</p>}{order.payment?.status === 'refund_failed' && <ErrorMessage error="Automatic refund failed. Refund this payment manually in your Stripe dashboard using the reference above." />}{order.cancelReason && <p>Cancellation: {order.cancelReason}</p>}</section>
      <div className="catalog-asset-divider"><DesignIcon file="a824b" /></div><section className="order-timeline"><h3>Timeline</h3><ol>{visibleStages.map(([status, label], index) => {
        const event = order.events?.findLast((event) => event.to === status)
        const inProgress = status === order.status && ['accepted', 'preparing'].includes(status)
        const done = !inProgress && (!!event || (index < currentIndex && order.status !== 'cancelled'))
        const next = index === currentIndex + 1 && ['ready', 'out_for_delivery'].includes(order.status)
        return <li key={status} className={inProgress || next ? 'timeline-current' : ''} title={event ? `${event.actor?.name || event.actor?.type || ''} · ${dateTime(event.at)}${event.note ? ` · ${event.note}` : ''}` : undefined}><DesignIcon file={done ? '4e035' : inProgress ? '3f3c2' : next ? '0f62e' : '2ebb8'} /><span>{label}</span><small>{inProgress ? 'In Progress' : event ? clock(event.at) : 'Pending'}</small></li>
      })}</ol></section>
      <div className="order-panel-actions">{!detail.loading && renderActions(order)}{order.status === 'completed' && <p className="order-complete">Complete</p>}{order.estimatedReadyAt && !['completed', 'cancelled'].includes(order.status) && <p className="order-detail-note">Estimated ready {dateTime(order.estimatedReadyAt)}</p>}</div>
      <span className="sr-only">{statusLabels[order.status]} · {order.paymentMethod} · {order.payment?.status || order.paymentStatus}</span>
    </>}
  </aside></div>
}
