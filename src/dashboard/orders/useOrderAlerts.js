import { useEffect, useRef } from 'react'
import { tenant } from '../../lib/tenant'
import { useRemote } from '../../lib/useRemote'

export function useOrderAlerts(summary, enabled, onAlert, scope) {
  const preferences = useRemote(() => enabled ? tenant.get('notification-preferences') : Promise.resolve(null), [enabled])
  const refresh = preferences.refresh
  const previous = useRef(null)
  const audio = useRef(null)
  useEffect(() => {
    const changed = () => { if (enabled) refresh() }
    const unlock = () => {
      const Audio = window.AudioContext || window.webkitAudioContext
      if (!enabled || !Audio) return
      audio.current ||= new Audio()
      audio.current.resume().catch(() => {})
    }
    window.addEventListener('tenant-notifications-changed', changed)
    window.addEventListener('pointerdown', unlock)
    return () => {
      window.removeEventListener('tenant-notifications-changed', changed)
      window.removeEventListener('pointerdown', unlock)
      audio.current?.close().catch(() => {}); audio.current = null
    }
  }, [enabled, refresh])
  useEffect(() => {
    if (!summary) return
    const snapshot = previous.current
    if (snapshot && snapshot.scope !== scope) { previous.current = { scope, summary: null, ignore: summary }; return }
    if (snapshot?.ignore === summary) return
    const before = snapshot?.summary
    previous.current = { scope, summary }
    const prefs = preferences.data?.data
    if (!enabled || !before || !prefs) return
    if ((summary.placed || 0) > (before.placed || 0) && prefs.newOrderAlerts) {
      onAlert('A new order is waiting to be accepted.')
      const ctx = audio.current
      if (ctx?.state === 'running') {
        const tone = ctx.createOscillator(), gain = ctx.createGain()
        tone.connect(gain); gain.connect(ctx.destination)
        tone.frequency.value = 880
        gain.gain.setValueAtTime(0.08, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
        tone.start(); tone.stop(ctx.currentTime + 0.3)
      }
    } else if (prefs.orderStatusUpdates && ['accepted', 'preparing', 'ready', 'out_for_delivery'].some((key) => summary[key] !== before[key])) onAlert((current) => current || 'Order statuses have been updated.')
  }, [summary, enabled, preferences.data, onAlert, scope])
}
