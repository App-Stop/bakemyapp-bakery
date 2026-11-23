import assert from 'node:assert/strict'
import { createServer as httpServer } from 'node:http'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'

// Real React screens in Chrome, with a local contract fixture backend. No live writes.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const requests = []
const failures = []
const categories = [{ id: 'cat-1', name: 'Cakes', description: null, isActive: true, productCount: 1 }]
const branch = { id: 'branch-1', name: 'Clifton', addressLine1: 'Shop 4', addressLine2: null, area: 'Clifton', city: 'Karachi', phone: '0211234567', isActive: true, isAcceptingOrders: true, status: 'open', acceptsDelivery: true, acceptsPickup: true, deliveryFee: 15000, minimumOrder: 0, prepTimeMinutes: 30, hours: Array.from({ length: 7 }, (_, i) => ({ day: i + 1, isClosed: false, opensAt: '09:00', closesAt: '21:00' })) }
const branches = [branch]
const addon = { id: 'addon-1', name: 'Toppings', minSelect: 0, maxSelect: 2, productCount: 0, isActive: true, options: [{ id: 'option-1', name: 'Sprinkles', price: 0, isAvailable: true }, { id: 'option-2', name: 'Nuts', price: 5000, isAvailable: true }] }
const addons = [addon]
const products = [{ id: 'product-1', name: 'Chocolate cake', description: 'Freshly baked', category: categories[0], price: 25000, priceFrom: 25000, hasSizes: false, isActive: true, sizes: [], addonSets: [], branches: [{ id: branch.id, name: branch.name, available: true }], photo: null }]
const next = { placed: ['accepted', 'cancelled'], accepted: ['preparing', 'cancelled'], preparing: ['ready', 'cancelled'], ready: ['out_for_delivery', 'cancelled'], out_for_delivery: ['completed', 'cancelled'], completed: [], cancelled: [] }
const order = { id: 'order-1', number: 1042, status: 'placed', fulfilment: 'delivery', paymentMethod: 'cod', paymentStatus: 'unpaid', currencySymbol: 'Rs', subtotal: 25000, deliveryFee: 15000, total: 40000, itemCount: 1, customer: { name: 'Ayesha', phone: '03001234567', email: 'customer@example.test' }, branch: { id: branch.id, name: branch.name }, area: 'Clifton', placedAt: '2026-11-23T08:00:00Z', nextStatuses: next.placed, payment: { method: 'cod', status: 'unpaid', reference: null }, address: { addressLine1: 'Home 1', city: 'Karachi', instructions: 'Ring the bell' }, notes: 'Birthday order', items: [{ id: 'line-1', productName: 'Chocolate cake', sizeName: 'Small', quantity: 1, lineTotal: 25000, note: 'No icing', addons: [{ setName: 'Toppings', optionName: 'Nuts', price: 5000 }] }], events: [{ to: 'placed', actor: { name: 'Ayesha', type: 'customer' }, at: '2026-11-23T08:00:00Z' }] }
let signedIn = false
let role = 'tenant_owner'
let conflict = false
const paged = (rows) => ({ data: rows, pagination: { currentPage: 1, itemsPerPage: 10, totalPages: 1, totalItems: rows.length } })
const backend = httpServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  const chunks = []; for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks)
  const body = req.headers['content-type']?.includes('application/json') ? JSON.parse(raw.toString()) : raw
  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname.replace('/v1/tenant/', '')
  requests.push({ method: req.method, path, params: Object.fromEntries(url.searchParams), body })
  const send = (data, status = 200, extra = {}) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: status < 400, message: status === 403 ? 'You are not assigned to a branch yet. Ask your manager.' : status === 409 ? 'Order changed.' : 'OK', data, ...extra })) }
  try {
    if (path === 'auth/login') { signedIn = true; role = body.email.startsWith('branch') ? 'branch_staff' : 'tenant_owner'; return send({ accessToken: 'test-token' }) }
    if (path === 'auth/refresh') return send({ accessToken: 'test-token' }, signedIn ? 200 : 401)
    assert.equal(req.headers.authorization, 'Bearer test-token', `${path} must be authenticated`)
    if (path === 'auth/logout') { signedIn = false; return send({}) }
    if (path === 'me') return send({ id: 'user-1', name: 'Owner', role, roleName: role === 'branch_staff' ? 'Branch Staff' : 'Owner', permissions: role === 'branch_staff' ? ['orders:view', 'orders:manage'] : ['*'], tenant: { name: 'Test Bakery' }, branch: role === 'branch_staff' ? { id: branch.id, name: branch.name } : null })
    if (role === 'branch_staff' && !path.startsWith('orders')) throw new Error(`Branch staff requested forbidden area: ${path}`)
    if (path === 'branding') return send({ currencySymbol: 'Rs' })
    if (path === 'plan') return send({ usage: { branches: { used: branches.filter((item) => item.isActive).length, limit: 3 } } })
    const filtered = (rows) => rows.filter((item) => !url.searchParams.get('status') || url.searchParams.get('status') === 'all' || item.isActive === (url.searchParams.get('status') === 'active'))
    if (path === 'menu/categories') { if (req.method === 'GET') return send(filtered(categories)); const item = { id: `cat-${categories.length + 1}`, ...body, isActive: true, productCount: 0 }; categories.push(item); return send(item, 201) }
    if (path === 'menu/categories/order') return send(categories)
    if (/^menu\/categories\//.test(path)) { const item = categories.find((item) => item.id === path.split('/')[2]); if (req.method === 'PATCH') Object.assign(item, body); if (req.method === 'DELETE') item.isActive = false; return send(item) }
    if (path === 'menu/addon-sets') { if (req.method === 'GET') return send(filtered(addons)); const item = { id: `addon-${addons.length + 1}`, ...body, isActive: true, productCount: 0 }; addons.push(item); return send(item) }
    if (/^menu\/addon-sets\//.test(path)) { const item = addons.find((item) => item.id === path.split('/')[2]); if (path.endsWith('/options')) item.options = body.options.map((option, i) => ({ id: option.id || `new-option-${i}`, ...option })); else if (req.method === 'PATCH') Object.assign(item, body); else if (req.method === 'DELETE') item.isActive = false; return send(item) }
    if (path === 'menu/products') {
      if (req.method === 'GET') { const rows = filtered(products).filter((item) => !url.searchParams.get('categoryId') || item.category.id === url.searchParams.get('categoryId')); return send(rows, 200, { pagination: paged(rows).pagination }) }
      assert.ok(!('price' in body && 'sizes' in body), 'price and sizes are mutually exclusive')
      const item = { id: `product-${products.length + 1}`, ...body, category: categories.find((category) => category.id === body.categoryId), priceFrom: body.price, sizes: [], hasSizes: false, isActive: true, addonSets: [], branches: [{ id: branch.id, name: branch.name, available: true }] }; products.push(item); return send(item, 201)
    }
    if (path === 'menu/products/order') return send(products)
    if (/^menu\/products\//.test(path)) {
      const item = products.find((item) => item.id === path.split('/')[2])
      if (path.endsWith('/sizes')) { item.sizes = body.sizes.map((size, i) => ({ id: size.id || `size-${i}`, ...size })); item.hasSizes = !!item.sizes.length; item.price = item.hasSizes ? null : body.price; item.priceFrom = item.hasSizes ? Math.min(...item.sizes.map((size) => size.price)) : item.price }
      else if (path.endsWith('/addon-sets')) item.addonSets = addons.filter((set) => body.addonSetIds.includes(set.id))
      else if (path.endsWith('/branches')) item.branches = item.branches.map((branch) => ({ ...branch, available: !body.unavailableBranchIds.includes(branch.id) }))
      else if (path.endsWith('/photo')) { if (req.method === 'POST') { assert.equal(req.headers['content-type'], 'image/png'); assert.ok(raw.length > 100); item.photo = { url: 'data:image/png;base64,' + raw.toString('base64') } } else item.photo = null }
      else if (req.method === 'PATCH') Object.assign(item, body)
      else if (req.method === 'DELETE') item.isActive = false
      return send(item)
    }
    if (path === 'branches') { if (req.method === 'GET') return send(filtered(branches)); const item = { ...branch, id: `branch-${branches.length + 1}`, ...body }; branches.push(item); return send(item, 201) }
    if (path.startsWith('branches/')) { const item = branches.find((item) => item.id === path.split('/')[1]); if (path.endsWith('/hours')) { assert.equal(body.hours.length, 7); item.hours = body.hours } else if (path.endsWith('/pause')) item.isAcceptingOrders = !body.paused; else if (req.method === 'PATCH') Object.assign(item, body); else if (req.method === 'DELETE') item.isActive = false; return send(item) }
    if (path === 'team') return send([{ id: 'rider-1', name: 'Ali' }], 200, { pagination: paged([{}]).pagination })
    if (path === 'orders/summary') return send({ placed: order.status === 'placed' ? 1 : 0, accepted: 0, preparing: 0, ready: 0, out_for_delivery: 0, active: next[order.status].length ? 1 : 0, refundsNeeded: order.paymentStatus === 'refund_failed' ? 1 : 0 })
    if (path === 'orders') {
      const status = url.searchParams.get('status')
      const paymentStatus = url.searchParams.get('paymentStatus')
      const matchesStatus = !status || (status === 'active' ? !['completed', 'cancelled'].includes(order.status) : status === 'past' ? ['completed', 'cancelled'].includes(order.status) : status.split(',').includes(order.status))
      const rows = matchesStatus && (!paymentStatus || paymentStatus === order.paymentStatus) ? [order] : []
      return send(rows, 200, { pagination: paged(rows).pagination })
    }
    if (path === 'orders/order-1/status') {
      assert.ok(order.nextStatuses.includes(body.status))
      if (conflict) { conflict = false; order.status = body.status; order.nextStatuses = next[body.status]; return send({}, 409) }
      order.status = body.status; order.nextStatuses = next[body.status]
      if (body.status === 'completed') { order.paymentStatus = 'paid'; order.payment.status = 'paid' }
      order.events.push({ to: body.status, actor: { name: 'Owner', type: 'user' }, at: '2026-11-23T09:00:00Z' })
      return send(order)
    }
    if (path === 'orders/order-1') return send(order)
    throw new Error(`Unexpected route ${req.method} ${path}`)
  } catch (error) { failures.push(error.message); send({}, 500) }
})

let browser, vite, socket, profile
try {
  console.log('Starting local fixture backend…')
  await new Promise((resolve) => backend.listen(0, '127.0.0.1', resolve))
  process.env.VITE_API_URL = `http://127.0.0.1:${backend.address().port}`
  console.log('Starting Vite…')
  vite = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' })
  await vite.listen()
  console.log('Starting headless browser…')
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`
  const candidates = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  let executable
  for (const path of candidates) { try { await access(path); executable = path; break } catch { /* Try the next installed browser. */ } }
  assert.ok(executable, 'Install Chrome/Edge or set CHROME_PATH to run browser checks.')
  profile = await mkdtemp(join(tmpdir(), 'bma-browser-'))
  browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
  let debugPort
  for (let i = 0; i < 150; i++) { try { debugPort = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break } catch { await sleep(100) } }
  assert.ok(debugPort, 'Chrome did not start its debugging endpoint.')
  const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json`, { signal: AbortSignal.timeout(5000) })).json()
  socket = new WebSocket(pages.find((page) => page.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Could not connect to Chrome’s local debugging socket.')), 5000)
    socket.addEventListener('open', () => { clearTimeout(timer); resolve() }, { once: true })
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Chrome debugging connection failed.')) }, { once: true })
  })
  let counter = 0; const pending = new Map(); const browserErrors = []
  socket.addEventListener('message', (event) => { const data = JSON.parse(event.data); if (data.id) { const task = pending.get(data.id); pending.delete(data.id); if (data.error) task.reject(data.error); else task.resolve(data.result) } else if (data.method === 'Runtime.exceptionThrown') browserErrors.push(data.params.exceptionDetails.text + ' ' + (data.params.exceptionDetails.exception?.description || '')) })
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++counter; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (expression) => { const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value }
  const wait = async (condition, description = condition) => { for (let i = 0; i < 200; i++) { if (await evaluate(condition)) return; await sleep(50) } throw new Error(`Timed out: ${description}\n${await evaluate('document.body.innerText')}`) }
  const text = (value) => `document.body.innerText.includes(${JSON.stringify(value)})`
  const click = async (label, selector = 'button') => { await wait(`[...document.querySelectorAll(${JSON.stringify(selector)})].some(e=>e.textContent.trim()===${JSON.stringify(label)} && !e.matches(':disabled'))`, `button ${label}`); await evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(label)} && !e.matches(':disabled')).click()`); await sleep(50) }
  const fill = async (name, value) => { await wait(`document.querySelector('input[name=${JSON.stringify(name)}]')?.matches(':enabled')`, `input ${name}`); await evaluate(`(()=>{const e=document.querySelector('input[name=${JSON.stringify(name)}]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)}); e.dispatchEvent(new Event('input',{bubbles:true}));})()`); await sleep(20) }
  const closeModal = () => evaluate(`document.querySelector('button[aria-label="Close dialog"]').click()`)
  const awaitRequest = async (method, path) => { for (let i = 0; i < 100; i++) { const found = requests.findLast((request) => request.method === method && request.path === path); if (found) return found; await sleep(50) } throw new Error(`No request: ${method} ${path}`) }
  await cdp('Runtime.enable')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await cdp('Page.navigate', { url: `${origin}/?dashboard` })
  console.log('Checking sign-in and Menu…')
  await wait(text('Sign in to your bakery'))
  await evaluate('window.confirm=()=>true')
  await fill('email', 'owner@example.test'); await fill('password', 'long-test-password')
  await click('Sign in'); await wait(text('Chocolate cake'))
  assert.equal((await evaluate('document.querySelector("aside").innerText')).includes('Test Bakery'), true)
  await click('Add Category'); await fill('name', 'Pastries'); await click('Save category'); await wait('!document.querySelector("[role=dialog]")')
  assert.equal((await awaitRequest('POST', 'menu/categories')).body.name, 'Pastries')
  await click('Add New Item'); await fill('name', 'Cupcake'); await fill('price', '150.50'); await click('Create product'); await wait(text('Save sizes'))
  assert.equal((await awaitRequest('POST', 'menu/products')).body.price, 15050)
  await wait(`document.querySelector('label input[type=checkbox]')?.matches(':enabled')`)
  await evaluate(`document.querySelector('label input[type=checkbox]').click()`)
  await fill('sizes.0.name', 'Small'); await fill('sizes.0.price', '90.50'); await click('Save sizes'); await wait(text('Saved.'))
  assert.equal((await awaitRequest('PUT', 'menu/products/product-2/sizes')).body.sizes[0].price, 9050)
  await click('Save sizes'); await sleep(100)
  assert.equal((await awaitRequest('PUT', 'menu/products/product-2/sizes')).body.sizes[0].id, 'size-0')
  await evaluate(`(()=>{const label=[...document.querySelectorAll('label')].find(e=>e.textContent.trim()==='Toppings');label.querySelector('input').click()})()`)
  await click('Save add-on groups')
  assert.deepEqual((await awaitRequest('PUT', 'menu/products/product-2/addon-sets')).body.addonSetIds, ['addon-1'])
  await evaluate(`(()=>{const label=[...document.querySelectorAll('label')].find(e=>e.textContent.trim()==='Clifton');label.querySelector('input').click()})()`)
  await click('Save branch availability')
  assert.deepEqual((await awaitRequest('PUT', 'menu/products/product-2/branches')).body.unavailableBranchIds, ['branch-1'])
  await evaluate(`(async()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=220;canvas.getContext('2d').fillRect(0,0,220,220);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));const dt=new DataTransfer();dt.items.add(new File([blob],'cake.png',{type:'image/png'}));const input=document.querySelector('input[type=file]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  await awaitRequest('POST', 'menu/products/product-2/photo'); await wait(text('Remove photo')); await click('Remove photo'); await awaitRequest('DELETE', 'menu/products/product-2/photo'); await closeModal()
  await click('Add-on groups'); await wait(text('Toppings')); await click('Edit'); await fill('options.0.price', '12.50'); await click('Save options')
  assert.equal((await awaitRequest('PUT', 'menu/addon-sets/addon-1/options')).body.options[0].price, 1250)
  await closeModal()
  console.log('PASS Menu: categories, product creation, size IDs, add-on/branch assignments, raw photo upload/removal, option prices')

  await click('Branches', 'nav button'); await wait(text('Ready in about 30 min'))
  await click('Add Branch'); await fill('name', 'Defence'); await fill('addressLine1', '12 Shahbaz'); await fill('city', 'Karachi'); await fill('deliveryFee', '200.50'); await click('Save branch'); await wait(text('Defence · Opening hours'))
  assert.equal((await awaitRequest('POST', 'branches')).body.deliveryFee, 20050)
  await evaluate(`document.querySelectorAll('input[type=checkbox]')[6].click()`)
  await click('Save opening hours'); await wait('!document.querySelector("[role=dialog]")')
  const hoursBody = (await awaitRequest('PUT', 'branches/branch-2/hours')).body.hours
  assert.equal(hoursBody.length, 7); assert.deepEqual(hoursBody[6], { day: 7, isClosed: true })
  await click('Pause orders'); assert.equal((await awaitRequest('POST', 'branches/branch-1/pause')).body.paused, true)
  console.log('PASS Branches: creation, integer delivery fees, automatic full-week hours editor, closed-day payload, pause')

  await click('Orders', 'nav button'); await wait(text('#1042')); await click('View details'); await wait(text('Ring the bell')); assert.ok(await evaluate(text('No icing'))); await evaluate(`document.querySelector('[aria-label="Close order details"]').click()`)
  await click('Accept order'); await fill('readyInMinutes', '25'); await click('Accept order', '[role=dialog] button'); await wait('!document.querySelector("[role=dialog]")')
  assert.deepEqual((await awaitRequest('POST', 'orders/order-1/status')).body, { status: 'accepted', readyInMinutes: 25 })
  await click('Start preparing'); await wait(text('Mark as ready'))
  conflict = true; await click('Mark as ready'); await wait(text('This order just changed.')); await wait(text('Dispatch'))
  await click('Dispatch'); await wait(`document.querySelector('select') && [...document.querySelectorAll('[role=dialog] option')].some(e=>e.textContent==='Ali')`)
  await evaluate(`(()=>{const e=document.querySelector('[role=dialog] select');e.value='rider-1';e.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  await click('Dispatch', '[role=dialog] button'); await wait('!document.querySelector("[role=dialog]")')
  assert.equal((await awaitRequest('POST', 'orders/order-1/status')).body.riderId, 'rider-1')
  await click('Delivered and paid'); await click('Completed'); await wait(text('cod · paid'))
  const beforePolling = requests.filter((request) => request.path === 'orders/summary').length
  await sleep(20500)
  assert.ok(requests.filter((request) => request.path === 'orders/summary').length > beforePolling, 'Orders summary should poll')
  await evaluate(`(()=>{const e=document.querySelector('input[placeholder="Order number, name or phone"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'1042');e.dispatchEvent(new Event('input',{bubbles:true}));})()`)
  await sleep(200)
  assert.equal((await awaitRequest('GET', 'orders')).params.q, '1042')
  console.log('PASS Orders: detail notes, acceptance time, conflict reload, branch rider lookup/dispatch, cash collection, polling, server search')

  order.status = 'placed'; order.nextStatuses = next.placed
  await click('Active'); await wait(text('Cancel order')); await click('Cancel order')
  await wait(text('Why are you cancelling?'))
  assert.equal(await evaluate(`[...document.querySelectorAll('[role=dialog] button')].find(e=>e.textContent.trim()==='Cancel order').disabled`), true)
  await click('Out of stock'); await click('Cancel order', '[role=dialog] button'); await wait('!document.querySelector("[role=dialog]")')
  assert.deepEqual((await awaitRequest('POST', 'orders/order-1/status')).body, { status: 'cancelled', reason: 'Out of stock' })
  order.paymentMethod = 'card'; order.paymentStatus = 'refund_failed'; order.payment = { method: 'card', status: 'refund_failed', reference: 'pi_test_reference' }
  await click('Refresh'); await wait(text('Refunds needed'))
  await evaluate(`([...document.querySelectorAll('button')].find(e=>e.textContent.includes('Refunds needed'))).click()`)
  await sleep(100)
  assert.equal((await awaitRequest('GET', 'orders')).params.paymentStatus, 'refund_failed')
  await click('View details'); await wait(text('Automatic refund failed.')); assert.ok(await evaluate(text('pi_test_reference')))
  await evaluate(`document.querySelector('[aria-label="Close order details"]').click()`)
  console.log('PASS Cancellations/refunds: required customer reason, failed-refund server filter, manual refund warning and Stripe reference')

  await evaluate(`document.querySelector('#dashboard-sidebar > div.relative > button').click()`); await click('Sign out'); await wait(text('Sign in to your bakery')); await fill('email', 'branch@example.test'); await fill('password', 'long-test-password')
  const branchStart = requests.length
  await click('Sign in'); await wait(text('Clifton · Refreshes every 20 seconds.'))
  assert.deepEqual(await evaluate('[...document.querySelectorAll("nav button")].map(e=>e.textContent.trim())'), ['Orders'])
  assert.equal(await evaluate('[...document.querySelectorAll("label")].some(e=>e.textContent.trim()==="Branch")'), false)
  assert.equal(requests.slice(branchStart).some((request) => /^(branches|branding|team|plan)/.test(request.path)), false)
  assert.ok(!Object.keys(await evaluate('({...localStorage})')).some((key) => /token|session/i.test(key)))
  assert.deepEqual(failures, [])
  assert.deepEqual(browserErrors, [])
  console.log('PASS Access: branch staff see Orders only, no branch/team/branding calls, no persisted tokens; no browser exceptions')
} catch (error) {
  console.error(error)
  if (failures.length) console.error('Mock backend failures:', failures)
  process.exitCode = 1
} finally {
  socket?.close()
  if (browser) { browser.kill(); await sleep(500) }
  await vite?.close()
  await new Promise((resolve) => backend.close(resolve))
  if (profile) { try { await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) } catch { /* Chrome can briefly hold files after exiting. */ } }
}
