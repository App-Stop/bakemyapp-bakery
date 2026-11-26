import test from 'node:test'
import assert from 'node:assert/strict'
import { createApiClient } from '../src/lib/api.js'
import { api } from '../src/lib/api.js'
import { tenant } from '../src/lib/tenant.js'
import { loyaltyForm, loyaltyPatch, rewardBody, walletCreditBody } from '../src/dashboard/loyalty/loyaltyHelpers.js'
import { setupDestination, planPrice } from '../src/dashboard/setup/setupHelpers.js'
import { mergeMessages, outgoingMessage, readChatEvents } from '../src/dashboard/support/chatHelpers.js'

test('loyalty rules and wallet credits preserve minor units, false flags and reasons', () => {
  const rules = { walletEnabled: true, pointsEnabled: false, pointsPerMajorUnit: 0.01, pointsValueMinor: 100, streakBonusPoints: 2 }
  assert.deepEqual(loyaltyPatch(rules, loyaltyForm(rules)), {})
  assert.deepEqual(loyaltyPatch(rules, { ...loyaltyForm(rules), walletEnabled: false, pointValue: '1.25' }), { walletEnabled: false, pointsValueMinor: 125 })
  assert.deepEqual(walletCreditBody('10.05', '  Sorry for the delay  '), { amount: 1005, reason: 'Sorry for the delay' })
  assert.deepEqual(walletCreditBody('0.01', 'Adjustment'), { amount: 1, reason: 'Adjustment' })
  for (const amount of ['0', '-1', '1.001', 'NaN', 'Infinity']) assert.throws(() => walletCreditBody(amount, 'Adjustment'))
  assert.throws(() => walletCreditBody('10', '  '))
  assert.throws(() => loyaltyPatch(rules, { ...loyaltyForm(rules), streakBonusPoints: '1.2' }))
  assert.throws(() => loyaltyPatch(rules, { ...loyaltyForm(rules), pointsPerMajorUnit: '' }))
  assert.deepEqual(rewardBody({ title: ' Cake ', description: '', pointsCost: '50', sortOrder: '2', isActive: false }), { title: 'Cake', description: null, pointsCost: 50, sortOrder: 2, isActive: false })
})

test('checklist navigation respects permissions and plan prices use the subscription currency', () => {
  assert.equal(setupDestination({ key: 'business', route: '/business' }, { permissions: ['business:view'] }), 'settings')
  assert.equal(setupDestination({ key: 'payments' }, { permissions: ['menu:view'] }), null)
  assert.equal(setupDestination({ route: 'https://external.test/unknown' }, { permissions: ['*'] }), null)
  assert.equal(planPrice(null), 'Custom')
  assert.match(planPrice({ amount: 29900, currency: 'USD' }), /299\.00/)
})

test('successful setup-related mutations invalidate progress while unrelated or failed writes do not', async () => {
  const previousWindow = globalThis.window, previousPatch = api.patch
  const events = []
  globalThis.window = { dispatchEvent: (event) => events.push(event.type) }
  api.patch = async () => ({ success: true, data: {} })
  try {
    await tenant.patch('store', {})
    await tenant.patch('loyalty', { walletEnabled: true })
    api.patch = async () => { throw new Error('Save failed') }
    await assert.rejects(tenant.patch('store', { name: 'New bakery' }))
    assert.deepEqual(events, ['tenant-setup-changed'])
  } finally { api.patch = previousPatch; if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow }
})

test('SSE parser accepts split UTF-8, CRLF, comments, multiline data and ignores incomplete frames', async () => {
  const bytes = new TextEncoder().encode('\uFEFF: keepalive\r\nevent: ready\r\ndata: {}\r\n\r\nevent: message\r\ndata: {"id":"message-1",\r\ndata: "body":"Café"}\r\n\r\nevent: message\ndata: incomplete')
  const body = new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close() } })
  const events = []
  await readChatEvents(body, (event) => events.push(event))
  assert.deepEqual(events, [{ type: 'ready', data: {} }, { type: 'message', data: { id: 'message-1', body: 'Café' } }])
  const messages = mergeMessages([{ id: 'a', body: 'Hello', createdAt: '2026-11-26T01:00:00Z' }], [{ id: 'b', body: 'Reply', createdAt: '2026-11-26T02:00:00Z' }, { id: 'a', body: 'Hello', createdAt: '2026-11-26T01:00:00Z' }])
  assert.deepEqual(messages.map((message) => message.id), ['a', 'b'])
  assert.equal(outgoingMessage({ senderType: 'bakery' }), true)
  assert.equal(outgoingMessage({ senderType: 'customer' }), false)
})

test('stream handshakes share token refresh with normal API calls and remain abortable after headers', async () => {
  let refreshes = 0, streamSignal
  const requests = []
  const json = (status, data) => new Response(JSON.stringify({ success: status === 200, data }), { status })
  const client = createApiClient({ baseUrl: 'https://fixture.test', fetcher: async (url, options) => {
    requests.push({ url, options })
    assert.equal(options.credentials, 'include')
    if (url.endsWith('/auth/refresh')) { refreshes++; await new Promise((resolve) => setTimeout(resolve, 10)); return json(200, { accessToken: 'fresh' }) }
    if (options.headers.Authorization !== 'Bearer fresh') return json(401, {})
    if (url.endsWith('/stream')) { streamSignal = options.signal; assert.equal(options.headers.Accept, 'text/event-stream'); return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('event: ready\ndata: {}\n\n')) } }), { headers: { 'Content-Type': 'text/event-stream' } }) }
    return json(200, [])
  } })
  client.setToken('expired')
  const abort = new AbortController()
  const [response] = await Promise.all([client.stream('/v1/tenant/support/chats/stream', { signal: abort.signal }), client.get('/v1/tenant/support/chats')])
  assert.equal(refreshes, 1)
  assert.equal(streamSignal.aborted, false)
  abort.abort()
  assert.equal(streamSignal.aborted, true)
  await response.body.cancel()
  assert.equal(requests.filter((request) => request.url.endsWith('/stream')).length, 2)
})
