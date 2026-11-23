import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, createApiClient } from '../src/lib/api.js'
import { can, changes, money, queryString, toMinor } from '../src/lib/tenant.js'

const response = (status, data = {}, error) => new Response(JSON.stringify({ success: status < 400, message: status === 422 ? 'Check the fields.' : 'Request failed.', data, error }), { status, headers: { 'Content-Type': 'application/json' } })
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done }); return { promise, resolve } }

test('concurrent unauthorized calls share one refresh and retry with the renewed token', async () => {
  let refreshes = 0
  const seen = []
  const client = createApiClient({ baseUrl: 'https://api.test', fetcher: async (url, options) => {
    seen.push({ url, ...options })
    if (url.endsWith('/auth/refresh')) { refreshes++; await new Promise((done) => setTimeout(done, 10)); return response(200, { accessToken: 'renewed' }) }
    return options.headers.Authorization === 'Bearer renewed' ? response(200, ['ok']) : response(401)
  } })
  client.setToken('expired')
  const result = await Promise.all([client.get('/v1/tenant/orders'), client.get('/v1/tenant/orders/summary'), client.get('/v1/tenant/branches')])
  assert.equal(refreshes, 1)
  assert.ok(result.every((item) => item.data[0] === 'ok'))
  assert.ok(seen.every((request) => request.credentials === 'include'))
  assert.equal(seen.filter((request) => request.headers.Authorization === 'Bearer renewed').length, 3)
})

test('a late 401 for an old token reuses the renewed token without rotating the cookie again', async () => {
  const late = deferred()
  let refreshes = 0
  const client = createApiClient({ baseUrl: 'https://api.test', fetcher: async (url, options) => {
    if (url.endsWith('/auth/refresh')) { refreshes++; return response(200, { accessToken: 'new' }) }
    if (options.headers.Authorization === 'Bearer new') return response(200)
    if (url.endsWith('/slow')) await late.promise
    return response(401)
  } })
  client.setToken('old')
  const slow = client.get('/v1/tenant/slow')
  await client.get('/v1/tenant/fast')
  late.resolve()
  await slow
  assert.equal(refreshes, 1)
})

test('failed refresh expires the session and stops retrying', async () => {
  let expired = 0; let calls = 0
  const client = createApiClient({ baseUrl: 'https://api.test', onSessionExpired: () => expired++, fetcher: async () => { calls++; return response(401) } })
  await assert.rejects(client.get('/v1/tenant/orders'), { status: 401 })
  assert.equal(calls, 2)
  assert.equal(expired, 1)
})

test('a second 401 after refresh does not loop', async () => {
  let calls = 0; let expired = 0
  const client = createApiClient({ baseUrl: 'https://api.test', onSessionExpired: () => expired++, fetcher: async (url) => { calls++; return url.endsWith('/refresh') ? response(200, { accessToken: 'new' }) : response(401) } })
  await assert.rejects(client.get('/v1/tenant/orders'), { status: 401 })
  assert.equal(calls, 3)
  assert.equal(expired, 1)
})

test('422 preserves nested field errors and never retries; 403 and 429 also do not refresh', async () => {
  for (const status of [422, 403, 429]) {
    let calls = 0
    const client = createApiClient({ baseUrl: 'https://api.test', fetcher: async () => { calls++; return response(status, {}, [{ path: 'hours.2.closesAt', message: 'Close after opening.' }]) } })
    await assert.rejects(client.put('/v1/tenant/branches/id/hours', { hours: [] }), (error) => error instanceof ApiError && error.status === status && error.fieldErrors['hours.2.closesAt'] === 'Close after opening.')
    assert.equal(calls, 1)
  }
})

test('raw photo bodies retain their content type and bearer token', async () => {
  const file = new Blob(['image'], { type: 'image/webp' })
  const client = createApiClient({ baseUrl: 'https://api.test', fetcher: async (url, options) => {
    assert.equal(options.method, 'POST')
    assert.equal(options.body, file)
    assert.equal(options.headers['Content-Type'], 'image/webp')
    assert.equal(options.headers.Authorization, 'Bearer token')
    return response(200)
  } })
  client.setToken('token')
  await client.post('/v1/tenant/menu/products/id/photo', file)
})

test('PATCH/PUT serialize numbers and DELETE/refresh have no fabricated body', async () => {
  const requests = []
  const client = createApiClient({ baseUrl: 'https://api.test', fetcher: async (url, options) => { requests.push(options); return response(200, { accessToken: 'token' }) } })
  await client.patch('/v1/tenant/branches/id', { deliveryFee: 15050 })
  await client.put('/v1/tenant/menu/products/id/sizes', { sizes: [], price: 25000 })
  await client.delete('/v1/tenant/menu/products/id/photo')
  await client.refresh()
  assert.deepEqual(requests.map((item) => item.method), ['PATCH', 'PUT', 'DELETE', 'POST'])
  assert.equal(JSON.parse(requests[0].body).deliveryFee, 15050)
  assert.equal(requests[2].body, undefined)
  assert.equal(requests[3].body, undefined)
})

test('public lead and login requests do not trigger tenant refresh', async () => {
  let calls = 0
  const client = createApiClient({ baseUrl: 'https://api.test', fetcher: async (url, options) => { calls++; assert.equal(options.headers.Authorization, undefined); return response(401) } })
  client.setToken('tenant-token')
  await assert.rejects(client.post('/v1/public/leads', {}), { status: 401 })
  await assert.rejects(client.post('/v1/tenant/auth/login', {}, { authenticated: false }), { status: 401 })
  assert.equal(calls, 2)
})

test('money, filters, permissions and PATCH change detection match the contract', () => {
  assert.equal(toMinor('150.50'), 15050)
  assert.equal(toMinor('0.01'), 1)
  assert.equal(toMinor('0'), 0)
  for (const value of ['', '-1', 'NaN', '1.234', '$15', 'Infinity']) assert.throws(() => toMinor(value))
  assert.equal(money(15050, 'Rs'), 'Rs 150.50')
  assert.equal(money(null), '—')
  const query = new URLSearchParams(queryString({ status: 'placed,accepted', branchId: '', q: 'A & B', page: 2 }).slice(1))
  assert.equal(query.get('status'), 'placed,accepted')
  assert.equal(query.get('q'), 'A & B')
  assert.equal(query.has('branchId'), false)
  assert.ok(can({ permissions: ['*'] }, 'menu:edit'))
  assert.equal(can({ permissions: ['orders:view'] }, 'branches:view'), false)
  assert.deepEqual(changes({ name: 'Same', phone: 'old', area: null }, { name: 'Same', phone: null, area: null }), { phone: null })
})
