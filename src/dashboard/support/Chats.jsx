import { rowsOf } from '../../lib/records'
import { useCallback, useEffect, useRef, useState } from 'react'
import { tenant, dateTime } from '../../lib/tenant'
import { useRemote } from '../../lib/useRemote'
import { CatalogPagination } from '../shared/CatalogUI'
import { ErrorMessage, buttonClass, primaryClass } from '../shared/ApiUI'
import { RemoteState, Textarea } from '../shared/WorkspaceUI'
import { mergeMessages, messageText, outgoingMessage } from './chatHelpers'
import { useChatStream } from './useChatStream'

export function Chats() {
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [revision, setRevision] = useState(0)
  const [dirty, setDirty] = useState(false)
  const conversations = useRemote(() => tenant.list('support/chats', { page, limit: 10 }), [page], { poll: 30000 })
  const refreshList = conversations.refresh
  const reload = useCallback(() => { refreshList(); setRevision((value) => value + 1) }, [refreshList])
  const stream = useChatStream(reload)
  const rows = rowsOf(conversations.data?.data, 'chats')
  const labels = { live: 'Live updates on', connecting: 'Connecting…', reconnecting: 'Reconnecting…', paused: 'Updates paused in background', blocked: 'Live updates unavailable' }
  const choose = (customerId) => {
    if (customerId === selected) return
    if (dirty && !window.confirm('Discard your unsent message and open another conversation?')) return
    setDirty(false); setSelected(customerId)
  }
  return <div className="workspace-stack"><div className="workspace-row"><div><h2 className="font-semibold text-lg">Customer conversations</h2><p className="workspace-hint">Keep up with questions from your bakery’s customers.</p></div><div className="workspace-actions"><span className={`workspace-badge ${stream.status === 'live' ? '' : 'workspace-badge-muted'}`} role="status">{labels[stream.status]}</span><button className={buttonClass} onClick={reload}>Refresh chats</button>{['blocked', 'reconnecting'].includes(stream.status) && <button className={buttonClass} onClick={() => { reload(); stream.reconnect() }}>Reconnect updates</button>}</div></div>
    {stream.status === 'blocked' && <ErrorMessage error={stream.error} />}
    <div className="support-chat"><aside className="support-conversations" aria-label="Customer conversations"><RemoteState remote={conversations} label="conversations" empty={!rows.length}><div className="support-conversation-list">{rows.map((chat) => { const id = chat.customerId || chat.customer?.id; return <button key={id} className="support-conversation" aria-pressed={selected === id} onClick={() => choose(id)}><strong>{chat.customer?.name || chat.customerName || 'Customer'}</strong>{chat.needsReply && <span className="workspace-badge self-start">Needs reply</span>}<p className="workspace-hint">{typeof chat.lastMessage === 'string' ? chat.lastMessage : messageText(chat.lastMessage || {})}</p><small className="workspace-hint">{dateTime(chat.lastMessageAt || chat.lastMessage?.createdAt || chat.updatedAt)}</small></button> })}</div></RemoteState><CatalogPagination pagination={conversations.data?.pagination || conversations.data?.data?.pagination} page={page} count={rows.length} noun="conversations" onChange={setPage} disabled={conversations.loading} /></aside>
      {selected ? <Conversation key={selected} customerId={selected} revision={revision} onSent={refreshList} onDraft={setDirty} /> : <div className="support-messages justify-center"><p className="workspace-empty">Choose a conversation to read and reply.</p></div>}
    </div>
  </div>
}
async function loadMessages(customerId, after, signal) {
  let cursor = after, customer, all = []
  const seen = new Set()
  while (!signal.aborted) {
    const result = await tenant.list(`support/chats/${customerId}`, { after: cursor, limit: 50 }, { signal })
    const data = result.data
    customer = data?.customer || customer
    const rows = rowsOf(data, 'messages')
    all = mergeMessages(all, rows)
    const last = rows.at(-1)?.id
    if (rows.length < 50 || !last || last === cursor || seen.has(last)) break
    seen.add(last); cursor = last
  }
  return { customer, messages: all }
}
function Conversation({ customerId, revision, onSent, onDraft }) {
  const [messages, setMessages] = useState([])
  const [customer, setCustomer] = useState(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sendError, setSendError] = useState(null)
  const [busy, setBusy] = useState(false)
  const state = useRef({ disposed: false, sequence: 0, cursor: undefined, controller: null })
  const messageList = useRef(null)
  const atBottom = useRef(true)
  const refresh = useCallback(async (reset = false) => {
    const ref = state.current
    ref.controller?.abort(); ref.controller = new AbortController()
    const request = ++ref.sequence
    if (!ref.cursor) setLoading(true)
    try {
      const data = await loadMessages(customerId, reset ? undefined : ref.cursor, ref.controller.signal)
      if (ref.disposed || request !== ref.sequence) return
      if (data.customer) setCustomer(data.customer)
      setMessages((previous) => { const merged = mergeMessages(reset ? [] : previous, data.messages); ref.cursor = merged.at(-1)?.id; return merged })
      setError(null)
    } catch (err) { if (!ref.disposed && request === ref.sequence && err.name !== 'AbortError') setError(err) } finally { if (!ref.disposed && request === ref.sequence) setLoading(false) }
  }, [customerId])
  useEffect(() => {
    const ref = state.current; ref.disposed = false
    refresh()
    return () => { ref.disposed = true; ref.sequence++; ref.controller?.abort() }
  }, [refresh, revision])
  useEffect(() => { if (atBottom.current && messageList.current) messageList.current.scrollTop = messageList.current.scrollHeight }, [messages])
  const send = async (event) => {
    event.preventDefault(); if (!draft.trim() || busy) return
    setBusy(true); setSendError(null)
    try {
      const result = await tenant.post(`support/chats/${customerId}/messages`, { body: draft.trim() })
      if (state.current.disposed) return
      const sent = result.data?.message || result.data
      if (sent?.id) setMessages((previous) => mergeMessages(previous, [sent]))
      setDraft(''); onDraft(false); atBottom.current = true
      await Promise.all([refresh(), onSent()])
    } catch (err) { if (!state.current.disposed) setSendError(err) } finally { if (!state.current.disposed) setBusy(false) }
  }
  return <section className="support-messages" aria-label="Conversation"><div className="workspace-card-heading"><div><h3 className="font-semibold">{customer?.name || 'Customer conversation'}</h3><p className="workspace-hint">{customer?.email}</p></div><button className={buttonClass} disabled={loading} onClick={() => refresh()}>Refresh conversation</button></div><ErrorMessage error={error} />{error && <button className={`${buttonClass} self-start`} onClick={() => refresh()}>Retry conversation</button>}
    <div className="support-message-list" ref={messageList} role="log" aria-label="Chat messages" aria-live="polite" onScroll={(event) => { const node = event.currentTarget; atBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 60 }}>{loading && !messages.length ? <p className="workspace-empty" role="status">Loading messages…</p> : !messages.length && !error ? <p className="workspace-empty">No messages yet.</p> : messages.map((message) => <article key={message.id} className="support-message" data-outgoing={outgoingMessage(message)}><p>{messageText(message)}</p><small>{outgoingMessage(message) ? 'Bakery' : customer?.name || 'Customer'} · {dateTime(message.createdAt)}</small></article>)}</div>
    <form className="workspace-stack mt-auto" onSubmit={send}><ErrorMessage error={sendError} /><Textarea label="Message to customer" name="body" value={draft} maxLength={1000} required disabled={busy || loading || !!error} errors={sendError?.fieldErrors} onChange={(e) => { setDraft(e.target.value); onDraft(!!e.target.value.trim()) }} /><div className="workspace-row"><p className="workspace-hint">Up to 1,000 characters.</p><button className={primaryClass} disabled={busy || loading || !!error || !draft.trim()}>{busy ? 'Sending…' : 'Send message'}</button></div></form>
  </section>
}
