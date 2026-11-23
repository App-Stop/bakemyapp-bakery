import { useCallback, useEffect, useRef, useState } from 'react'

export function useRemote(loader, dependencies = [], { poll = 0 } = {}) {
  const loadRef = useRef(loader)
  useEffect(() => { loadRef.current = loader })
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const sequence = useRef(0)
  const pollingBlocked = useRef(false)
  const invalidate = useCallback(() => { sequence.current++ }, [])
  const refresh = useCallback(async () => {
    const request = ++sequence.current
    setState((previous) => ({ ...previous, loading: true }))
    try {
      const data = await loadRef.current()
      pollingBlocked.current = false
      if (sequence.current === request) setState({ data, loading: false, error: null })
      return data
    } catch (error) {
      pollingBlocked.current = error.status === 429 || error.status === 403
      if (sequence.current === request) setState((previous) => ({ ...previous, loading: false, error }))
      return null
    }
  }, [])
  useEffect(() => {
    refresh()
    const timer = poll ? setInterval(() => { if (!pollingBlocked.current && document.visibilityState !== 'hidden') refresh() }, poll) : null
    const visible = () => { if (poll && !pollingBlocked.current && document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', visible)
    return () => { invalidate(); clearInterval(timer); document.removeEventListener('visibilitychange', visible) }
    // Request dependencies are provided by the caller, as with useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, poll, refresh, invalidate])
  return { ...state, refresh }
}
