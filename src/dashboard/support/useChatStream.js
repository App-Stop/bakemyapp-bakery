import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { readChatEvents } from './chatHelpers'

export function useChatStream(onEvent) {
  const handler = useRef(onEvent)
  useEffect(() => { handler.current = onEvent }, [onEvent])
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ status: 'connecting', error: null })
  useEffect(() => {
    let disposed = false, connection, timer, failures = 0, blocked = false
    const connect = async () => {
      if (disposed || blocked || document.visibilityState === 'hidden') return
      const controller = new AbortController()
      connection = controller
      setState({ status: failures ? 'reconnecting' : 'connecting', error: null })
      try {
        const response = await api.stream('/v1/tenant/support/chats/stream', { signal: controller.signal })
        if (disposed || controller.signal.aborted) return
        failures = 0; setState({ status: 'live', error: null })
        await readChatEvents(response.body, (event) => { if (!disposed && !controller.signal.aborted && ['ready', 'message'].includes(event.type)) handler.current(event) }, controller.signal)
        if (!controller.signal.aborted) throw new Error('The live connection was interrupted.')
      } catch (error) {
        if (disposed || controller.signal.aborted) return
        blocked = [401, 403, 429].includes(error.status)
        if (!blocked) handler.current({ type: 'disconnected' })
        setState({ status: blocked ? 'blocked' : 'reconnecting', error })
        if (!blocked) timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(failures++, 5)))
      }
    }
    const visibility = () => {
      clearTimeout(timer); connection?.abort()
      if (blocked) return
      if (document.visibilityState === 'hidden') setState({ status: 'paused', error: null })
      else connect()
    }
    document.addEventListener('visibilitychange', visibility)
    connect()
    return () => { disposed = true; clearTimeout(timer); connection?.abort(); document.removeEventListener('visibilitychange', visibility) }
  }, [attempt])
  return { ...state, reconnect: () => setAttempt((value) => value + 1) }
}
