export function mergeMessages(current, incoming) {
  const messages = new Map(current.map((message) => [message.id, message]))
  for (const message of incoming) if (message?.id) messages.set(message.id, { ...messages.get(message.id), ...message })
  return [...messages.values()].sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0))
}
export const messageText = (message) => message.body ?? message.text ?? message.message ?? ''
export const outgoingMessage = (message) => message.isFromCustomer === false || message.direction === 'outgoing' || ['tenant', 'user', 'staff', 'bakery', 'admin'].includes(message.senderType || message.sender?.type || message.sender || message.from)

export async function readChatEvents(body, onEvent, signal) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = '', event = '', lines = [], first = true
  const dispatch = () => {
    if (lines.length) {
      let data = lines.join('\n')
      try { data = JSON.parse(data) } catch { /* Unknown text events can still trigger a safe reload. */ }
      onEvent({ type: event || 'message', data })
    }
    event = ''; lines = []
  }
  const process = (line) => {
    if (!line) { dispatch(); return }
    if (line.startsWith(':')) return
    const colon = line.indexOf(':')
    const key = colon < 0 ? line : line.slice(0, colon)
    let value = colon < 0 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (key === 'event') event = value
    if (key === 'data') lines.push(value)
  }
  try {
    while (!signal?.aborted) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      if (first && buffer.length) { buffer = buffer.replace(/^\uFEFF/, ''); first = false }
      let match
      while ((match = /\r\n|\r|\n/.exec(buffer))) {
        if (!done && match[0] === '\r' && match.index === buffer.length - 1) break
        process(buffer.slice(0, match.index)); buffer = buffer.slice(match.index + match[0].length)
      }
      if (done) break
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}
