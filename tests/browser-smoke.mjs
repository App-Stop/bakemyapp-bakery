import assert from 'node:assert/strict'
import { createServer as httpServer } from 'node:http'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, access, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'

// Real React screens in Chrome, with a local contract fixture backend. No live writes.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const requests = []
const failures = []
const designCheck = process.argv.includes('--catalog-design')
const categories = [{ id: 'cat-1', name: 'Cakes', description: null, isActive: true, productCount: 1 }]
const branch = { id: 'branch-1', name: 'Clifton', addressLine1: 'Shop 4', addressLine2: null, area: 'Clifton', city: 'Karachi', phone: '0211234567', isActive: true, isAcceptingOrders: true, status: 'open', acceptsDelivery: true, acceptsPickup: true, deliveryFee: 15000, minimumOrder: 0, prepTimeMinutes: 30, hours: Array.from({ length: 7 }, (_, i) => ({ day: i + 1, isClosed: false, opensAt: '09:00', closesAt: '21:00' })) }
const branches = [branch]
const addon = { id: 'addon-1', name: 'Toppings', minSelect: 0, maxSelect: 2, productCount: 0, isActive: true, options: [{ id: 'option-1', name: 'Sprinkles', price: 0, isAvailable: true }, { id: 'option-2', name: 'Nuts', price: 5000, isAvailable: true }] }
const addons = [addon]
const products = [{ id: 'product-1', name: 'Chocolate cake', description: 'Freshly baked', category: categories[0], price: 25000, priceFrom: 25000, hasSizes: false, isActive: true, sizes: [], addonSets: [], branches: [{ id: branch.id, name: branch.name, available: true }], photo: null }]
const next = { placed: ['accepted', 'cancelled'], accepted: ['preparing', 'cancelled'], preparing: ['ready', 'cancelled'], ready: ['out_for_delivery', 'cancelled'], out_for_delivery: ['completed', 'cancelled'], completed: [], cancelled: [] }
const order = { id: 'order-1', number: 1042, status: 'placed', fulfilment: 'delivery', paymentMethod: 'cod', paymentStatus: 'unpaid', currencySymbol: 'Rs', subtotal: 25000, deliveryFee: 15000, total: 40000, itemCount: 1, customer: { name: 'Ayesha', phone: '03001234567', email: 'customer@example.test' }, branch: { id: branch.id, name: branch.name }, area: 'Clifton', placedAt: '2026-11-23T08:00:00Z', nextStatuses: next.placed, payment: { method: 'cod', status: 'unpaid', reference: null }, address: { addressLine1: 'Home 1', city: 'Karachi', instructions: 'Ring the bell' }, notes: 'Birthday order', items: [{ id: 'line-1', productName: 'Chocolate cake', sizeName: 'Small', quantity: 1, lineTotal: 25000, note: 'No icing', addons: [{ setName: 'Toppings', optionName: 'Nuts', price: 5000 }] }], events: [{ to: 'placed', actor: { name: 'Ayesha', type: 'customer' }, at: '2026-11-23T08:00:00Z' }] }
const designOrders = ['Sarah Jenkins', 'David Miller', 'Rachel Green', 'Chandler Bing', 'Monica Geller', 'Ross Geller', 'Phoebe Buffay', 'Joey Tribbiani'].map((name, i) => ({ ...order, id: `design-${i}`, number: 2493 - i, customer: { name, phone: '+1 (555) 321-9876' }, currencySymbol: '$', status: ['preparing', 'ready', 'preparing', 'preparing', 'ready', 'out_for_delivery', 'preparing', 'ready'][i], nextStatuses: next[['preparing', 'ready', 'preparing', 'preparing', 'ready', 'out_for_delivery', 'preparing', 'ready'][i]], fulfilment: [1, 6].includes(i) ? 'pickup' : 'delivery', branch: { id: branch.id, name: 'Downtown Main Branch' }, notes: null, address: { addressLine1: '415 Sourdough Lane, Apt 3B', city: 'Austin TX' }, subtotal: 1850, deliveryFee: 250, tax: 150, total: [2250, 1298, 3412, 1450, 1275, 900, 1025, 2200][i], items: [{ id: 'line-1', quantity: 2, productName: 'Artisanal Sourdough Loaf', lineTotal: 1200 }, { id: 'line-2', quantity: 1, productName: 'Flaky Butter Croissant', lineTotal: 250 }, { id: 'line-3', quantity: 1, productName: 'Vanilla Bean Pastry Cup', lineTotal: 400 }], events: [{ to: 'placed', at: '2026-11-23T05:14Z' }, { to: 'preparing', at: '2026-11-23T05:15Z' }] }))
if (designCheck) {
  categories.splice(0, categories.length, ...['Croissants', 'Donuts', 'Coffee', 'Bread', 'Pastries'].map((name, i) => ({ id: `cat-${i + 1}`, name, isActive: true, productCount: [5, 0, 6, 7, 4][i] })))
  products.splice(0, products.length, ...['Flaky Butter Croissant', 'Almond Frangipane Croissant', 'Double Chocolate Croissant', 'Matcha Cream Cruffin', 'Savory Ham & Cheese Croissant'].map((name, i) => ({ ...products[0], id: `product-${i + 1}`, name, category: categories[0], price: [250, 350, 300, 450, 400][i], priceFrom: [250, 350, 300, 450, 400][i], description: ['Pan-seared salmon with lemon butter and capers.', 'Twice-baked croissant filled with rich almond cream.', 'Soft croissant filled with 2x chocolate cream.', 'Slow-roasted tomato soup with basil and cream.', 'Braised short ribs in red wine with root vegetables.'][i], prepTimeMinutes: 10, isActive: i !== 3, photo: { url: `/figma/catalog/${['031ca', 'af5c3', 'e9960', 'ed961', '3b32d'][i]}.png` } })))
}
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
    if (path === 'auth/login') { if (body.password === 'invalid-password') return send({}, 422, { message: 'Check your password.', error: [{ path: 'password', message: 'Check your password.' }] }); signedIn = true; role = body.email.startsWith('branch') ? 'branch_staff' : 'tenant_owner'; return send({ accessToken: 'test-token' }) }
    if (path === 'auth/refresh') return send({ accessToken: 'test-token' }, signedIn ? 200 : 401)
    assert.equal(req.headers.authorization, 'Bearer test-token', `${path} must be authenticated`)
    if (path === 'auth/logout') { signedIn = false; return send({}) }
    if (path === 'me') return send({ id: 'user-1', name: designCheck ? 'Ross Bakers' : 'Owner', role, roleName: role === 'branch_staff' ? 'Branch Staff' : designCheck ? 'Owner account' : 'Owner', permissions: role === 'branch_staff' ? ['orders:view', 'orders:manage'] : ['*'], tenant: { name: designCheck ? 'Ross Bakers Co' : 'Test Bakery' }, branch: role === 'branch_staff' ? { id: branch.id, name: branch.name } : null })
    if (role === 'branch_staff' && !path.startsWith('orders')) throw new Error(`Branch staff requested forbidden area: ${path}`)
    if (path === 'branding') return send({ currencySymbol: designCheck ? '$' : 'Rs' })
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
      if (designCheck) return send(designOrders.map((item) => ({ ...item, status: url.searchParams.get('status') === 'completed' ? 'completed' : item.status })), 200, { pagination: { ...paged(designOrders).pagination, itemsPerPage: 8 } })
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
    if (designCheck && path.startsWith('orders/design-')) return send(designOrders.find((item) => item.id === path.split('/')[1]))
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
  const wait = async (condition, description = condition) => { for (let i = 0; i < 200; i++) { if (await evaluate(`Boolean(${condition})`)) return; await sleep(50) } throw new Error(`Timed out: ${description}\n${await evaluate('document.body.innerText')}`) }
  const text = (value) => `document.body.innerText.includes(${JSON.stringify(value)})`
  const click = async (label, selector = 'button') => { await wait(`[...document.querySelectorAll(${JSON.stringify(selector)})].some(e=>(e.textContent.trim()===${JSON.stringify(label)} || e.getAttribute('aria-label')===${JSON.stringify(label)}) && !e.matches(':disabled'))`, `button ${label}`); await evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>(e.textContent.trim()===${JSON.stringify(label)} || e.getAttribute('aria-label')===${JSON.stringify(label)}) && !e.matches(':disabled')).click()`); await sleep(50) }
  const fill = async (name, value) => { await wait(`document.querySelector('input[name=${JSON.stringify(name)}]')?.matches(':enabled')`, `input ${name}`); await evaluate(`(()=>{const e=document.querySelector('input[name=${JSON.stringify(name)}]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)}); e.dispatchEvent(new Event('input',{bubbles:true}));})()`); await sleep(20) }
  const closeModal = () => evaluate(`document.querySelector('button[aria-label="Close dialog"]').click()`)
  const awaitRequest = async (method, path) => { for (let i = 0; i < 100; i++) { const found = requests.findLast((request) => request.method === method && request.path === path); if (found) return found; await sleep(50) } throw new Error(`No request: ${method} ${path}`) }
  const runChecks = async () => {
  await cdp('Runtime.enable')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  for (const path of ['/', '/app', '/?dashboard']) {
    await cdp('Page.navigate', { url: `${origin}${path}` })
    await wait(text('Welcome back'))
    assert.equal(await evaluate('!!document.querySelector(".onboarding-page")'), false)
    await evaluate(`localStorage.setItem('bake-my-app:onboarding:v1', JSON.stringify({ launched: false }))`)
  }
  await cdp('Page.navigate', { url: `${origin}/` })
  console.log(process.argv.includes('--login-only') ? 'Checking sign-in…' : 'Checking sign-in and Menu…')
  await wait(text('Welcome back'))
  if (process.argv.includes('--login-only')) {
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1024, deviceScaleFactor: 1, mobile: false })
    await evaluate('document.fonts.ready.then(()=>true)')
    await mkdir('artifacts', { recursive: true })
    const assets = await evaluate(`Promise.all(['ambient-glow-top.svg','ambient-glow-bottom.svg','croissant.svg','eye-off.svg'].map(name=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({name,width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>reject(Error(name));image.src='/figma/login/'+name})))`)
    assert.deepEqual(assets.map(({ width, height }) => [width, height]), [[520, 520], [500, 500], [29, 29], [20, 20]])
    const layout = await evaluate(`(()=>{const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};return {panel:rect('.login-welcome'),card:rect('.login-card'),purple:getComputedStyle(document.querySelector('.login-submit')).backgroundColor,mask:getComputedStyle(document.querySelector('.login-croissant')).maskImage,glowTop:rect('.login-glow-top'),glowBottom:rect('.login-glow-bottom'),logo:rect('.login-croissant'),eye:rect('.login-visibility img')}})()`)
    assert.equal(Math.round(layout.panel.width), 620)
    assert.equal(layout.card.width, 480)
    assert.equal(layout.purple, 'rgb(85, 76, 241)')
    assert.ok(layout.mask.includes('/figma/login/croissant.svg'))
    assert.equal(layout.glowTop.width, 520); assert.equal(layout.glowBottom.width, 500)
    assert.equal(Math.round(layout.logo.width * 100), 2944); assert.equal(layout.eye.width, 20)
    await writeFile('artifacts/login-desktop.png', Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
    await fill('email', 'owner@example.test'); await fill('password', 'invalid-password')
    await evaluate(`document.querySelector('[aria-label="Show password"]').click()`)
    assert.equal(await evaluate(`document.querySelector('input[name=password]').type`), 'text')
    await evaluate(`document.querySelector('[aria-label="Hide password"]').click()`)
    assert.equal(await evaluate(`document.querySelector('input[name=password]').type`), 'password')
    await click('Sign in'); await wait(text('Check your password.'))
    assert.equal(await evaluate(`document.querySelector('input[name=password]').getAttribute('aria-invalid')`), 'true')
    await cdp('Page.navigate', { url: `${origin}/` }); await wait(text('Welcome back'))
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
    await evaluate('document.fonts.ready.then(()=>true)')
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true)
    assert.ok(await evaluate(`document.querySelector('.login-submit').getBoundingClientRect().bottom < window.innerHeight`))
    await writeFile('artifacts/login-mobile.png', Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
    await fill('email', 'owner@example.test'); await fill('password', 'long-test-password'); await click('Sign in')
    await wait('!document.querySelector(".login-page") && !!document.querySelector("#dashboard-sidebar")')
    assert.deepEqual((await awaitRequest('POST', 'auth/login')).body, { email: 'owner@example.test', password: 'long-test-password' })
    assert.deepEqual(failures, []); assert.deepEqual(browserErrors, [])
    console.log('PASS Sign-in: root/legacy routes, Figma asset geometry, purple palette, desktop/mobile layout, password visibility, validation errors and API sign-in')
    console.log('Screenshots: artifacts/login-desktop.png and artifacts/login-mobile.png')
    return
  }
  if (designCheck) {
    await fill('email', 'owner@example.test'); await fill('password', 'long-test-password'); await click('Sign in'); await wait(text('Flaky Butter Croissant'))
    const capture = async (name) => {
      await evaluate('document.fonts.ready.then(()=>true)')
      await wait('[...document.images].every(image => image.complete)')
      assert.deepEqual(await evaluate('[...document.images].filter(image => image.getClientRects().length && !image.naturalWidth).map(image=>image.src)'), [], `Images must load: ${name}`)
      const geometry = await evaluate(`Promise.all([...document.querySelectorAll('img.design-icon')].filter(image=>image.getClientRects().length).map(async image=>{const response=await fetch(image.src);const svg=new DOMParser().parseFromString(await response.text(),'image/svg+xml').documentElement;const rect=image.getBoundingClientRect();return {file:image.src.split('/').pop(),width:rect.width,height:rect.height,expectedWidth:Number(svg.getAttribute('width')),expectedHeight:Number(svg.getAttribute('height'))}}))`)
      for (const asset of geometry) { assert.ok(Math.abs(asset.width - asset.expectedWidth) < .1, `${asset.file}: width ${asset.width}`); assert.ok(Math.abs(asset.height - asset.expectedHeight) < .1, `${asset.file}: height ${asset.height}`) }
      assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, `No viewport overflow: ${name}`)
      await writeFile(`artifacts/${name}.png`, Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
    }
    await capture('menu-catalog-desktop')
    assert.equal(await evaluate(`document.querySelectorAll('.menu-product').length`), 5)
    await evaluate(`document.querySelector('[aria-label="In stock: Flaky Butter Croissant"]').click()`)
    await wait(`document.querySelector('[aria-label="In stock: Flaky Butter Croissant"]').getAttribute('aria-checked')==='false'`)
    assert.equal((await awaitRequest('DELETE', 'menu/products/product-1')).path, 'menu/products/product-1')
    await evaluate(`document.querySelector('[aria-label="In stock: Flaky Butter Croissant"]').click()`)
    await wait(`document.querySelector('[aria-label="In stock: Flaky Butter Croissant"]').getAttribute('aria-checked')==='true'`)
    await click('Add Category'); await fill('name', 'Donuts'); await capture('menu-add-category'); await closeModal()
    await click('Add Item'); await fill('name', 'Regular Donut'); await fill('price', '10.00'); await fill('description', 'Classic donut for your snacks'); await capture('menu-add-item'); await closeModal()
    await evaluate(`document.querySelectorAll('.menu-category button')[1].click()`); await wait(text('No Items')); await capture('menu-empty-desktop')
    await evaluate(`document.querySelectorAll('.menu-category button')[0].click()`); await wait(text('Flaky Butter Croissant'))
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await capture('menu-catalog-mobile')
    await click('Add Item'); await capture('menu-add-item-mobile'); await closeModal()
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1024, deviceScaleFactor: 1, mobile: false })
    await click('Orders', 'nav button'); await wait(text('#2493')); await capture('orders-active-desktop')
    await click('Today'); await sleep(100)
    assert.equal((await awaitRequest('GET', 'orders')).params.from, (await awaitRequest('GET', 'orders')).params.to)
    await click('7d')
    await click('View details for order #2493'); await wait(text('Timeline')); await capture('orders-preparing-panel')
    for (const [status, name] of [['ready', 'orders-ready-panel'], ['out_for_delivery', 'orders-dispatched-panel'], ['completed', 'orders-completed-panel']]) {
      designOrders[0].status = status; designOrders[0].nextStatuses = next[status]
      designOrders[0].events.push({ to: status, at: '2026-11-23T05:24Z' })
      await evaluate(`document.querySelector('[aria-label="Close order details"]').click()`)
      await click('View details for order #2493'); await wait(text('Timeline')); await capture(name)
    }
    await evaluate(`document.querySelector('[aria-label="Close order details"]').click()`)
    await click('Completed'); await wait(`document.querySelector('.orders-table-completed')`); await capture('orders-completed-desktop')
    await click('Active'); await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await capture('orders-active-mobile')
    await click('View details for order #2493'); await wait(text('Timeline')); await capture('orders-panel-mobile')
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' }); await wait('!document.querySelector(".order-detail-panel")')
    assert.deepEqual(failures, []); assert.deepEqual(browserErrors, [])
    console.log('PASS Figma catalog designs: desktop/mobile screenshots, all local SVG geometry, stock toggles, empty category, dialogs, date filters and four timeline states')
    return
  }
  await evaluate('window.confirm=()=>true')
  await fill('email', 'owner@example.test'); await fill('password', 'long-test-password')
  await click('Sign in'); await wait(text('Chocolate cake'))
  assert.equal((await evaluate('document.querySelector("aside").innerText')).includes('Test Bakery'), true)
  await evaluate(`document.querySelector('#dashboard-sidebar > div.relative > button').click()`)
  await wait(text('Sign out'))
  assert.equal(await evaluate(`document.body.innerText.includes('Start New Store') || document.body.innerText.includes('Storefront Preview & Edit')`), false)
  await evaluate(`document.querySelector('#dashboard-sidebar > div.relative > button').click()`)
  await click('Add Category'); await fill('name', 'Pastries'); await click('Add Category', '.dash-sheet button'); await wait('!document.querySelector("[role=dialog]")')
  assert.equal((await awaitRequest('POST', 'menu/categories')).body.name, 'Pastries')
  await click('Add Item'); await fill('name', 'Cupcake'); await fill('price', '150.50'); await click('Add Item', '.dash-sheet button'); await wait('!document.querySelector("[role=dialog]")'); await evaluate(`[...document.querySelectorAll('.menu-product')].find(e=>e.textContent.includes('Cupcake')).querySelector('button.menu-product-edit').click()`); await wait(text('Sizes, add-ons & branches')); await evaluate(`document.querySelector('.catalog-form-advanced').open=true`); await wait(text('Save sizes'))
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
  await click('Save Item'); await wait('!document.querySelector("[role=dialog]")'); await evaluate(`[...document.querySelectorAll('.menu-product')].find(e=>e.textContent.includes('Cupcake')).querySelector('button.menu-product-edit').click()`); await awaitRequest('POST', 'menu/products/product-2/photo'); await wait(text('Remove photo')); await click('Remove photo'); await awaitRequest('DELETE', 'menu/products/product-2/photo'); await closeModal()
  await evaluate(`document.querySelector('.catalog-tools').open=true`); await click('Add-on groups'); await wait(text('Toppings')); await click('Edit'); await fill('options.0.price', '12.50'); await click('Save options')
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

  await click('Orders', 'nav button'); await wait(text('#1042')); await click('View details for order #1042'); await wait(text('Ring the bell')); assert.ok(await evaluate(text('No icing'))); await evaluate(`document.querySelector('[aria-label="Close order details"]').click()`)
  await click('Accept order'); await fill('readyInMinutes', '25'); await click('Accept order', '.dash-sheet button'); await wait('!document.querySelector("[role=dialog]")')
  assert.deepEqual((await awaitRequest('POST', 'orders/order-1/status')).body, { status: 'accepted', readyInMinutes: 25 })
  await click('Start preparing'); await wait(text('Mark as ready'))
  conflict = true; await click('Mark as ready'); await wait(text('This order just changed.')); await wait(text('Dispatch'))
  await click('Dispatch'); await wait(`document.querySelector('select') && [...document.querySelectorAll('[role=dialog] option')].some(e=>e.textContent==='Ali')`)
  await evaluate(`(()=>{const e=document.querySelector('[role=dialog] select');e.value='rider-1';e.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  await click('Dispatch', '.dash-sheet button'); await wait('!document.querySelector("[role=dialog]")')
  assert.equal((await awaitRequest('POST', 'orders/order-1/status')).body.riderId, 'rider-1')
  await click('Delivered and paid'); await click('Completed'); await click('View details for order #1042'); await wait(text('Complete')); await evaluate(`document.querySelector('[aria-label="Close order details"]').click()`)
  const beforePolling = requests.filter((request) => request.path === 'orders/summary').length
  await sleep(20500)
  assert.ok(requests.filter((request) => request.path === 'orders/summary').length > beforePolling, 'Orders summary should poll')
  await evaluate(`(()=>{const e=document.querySelector('input[aria-label="Search orders"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'1042');e.dispatchEvent(new Event('input',{bubbles:true}));})()`)
  await sleep(200)
  assert.equal((await awaitRequest('GET', 'orders')).params.q, '1042')
  console.log('PASS Orders: detail notes, acceptance time, conflict reload, branch rider lookup/dispatch, cash collection, polling, server search')

  order.status = 'placed'; order.nextStatuses = next.placed
  await click('Active'); await click('View details for order #1042'); await wait(text('Cancel order')); await click('Cancel order')
  await wait(text('Why are you cancelling?'))
  assert.equal(await evaluate(`[...document.querySelectorAll('.dash-sheet button')].find(e=>e.textContent.trim()==='Cancel order').disabled`), true)
  await click('Out of stock'); await click('Cancel order', '.dash-sheet button'); await wait('!document.querySelector(".dash-sheet-backdrop")')
  assert.deepEqual((await awaitRequest('POST', 'orders/order-1/status')).body, { status: 'cancelled', reason: 'Out of stock' })
  order.paymentMethod = 'card'; order.paymentStatus = 'refund_failed'; order.payment = { method: 'card', status: 'refund_failed', reference: 'pi_test_reference' }
  await evaluate(`document.querySelector('[aria-label="Close order details"]').click()`); await evaluate(`document.querySelector('.catalog-tools').open=true`); await click('Refresh'); await wait(text('Refunds needed'))
  await evaluate(`([...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith('Refunds needed'))).click()`)
  await sleep(100)
  assert.equal((await awaitRequest('GET', 'orders')).params.paymentStatus, 'refund_failed')
  await click('View details for order #1042'); await wait(text('Automatic refund failed.')); assert.ok(await evaluate(text('pi_test_reference')))
  await evaluate(`document.querySelector('[aria-label="Close order details"]').click()`)
  console.log('PASS Cancellations/refunds: required customer reason, failed-refund server filter, manual refund warning and Stripe reference')

  await evaluate(`document.querySelector('#dashboard-sidebar > div.relative > button').click()`); await click('Sign out'); await wait(text('Welcome back')); await fill('email', 'branch@example.test'); await fill('password', 'long-test-password')
  const branchStart = requests.length
  await click('Sign in'); await wait(text('Clifton · Live ticket stream'))
  assert.deepEqual(await evaluate('[...document.querySelectorAll("nav button")].map(e=>e.textContent.trim())'), ['Orders'])
  assert.equal(await evaluate('[...document.querySelectorAll("label")].some(e=>e.textContent.trim()==="Branch")'), false)
  assert.equal(requests.slice(branchStart).some((request) => /^(branches|branding|team|plan)/.test(request.path)), false)
  assert.ok(!Object.keys(await evaluate('({...localStorage})')).some((key) => /token|session/i.test(key)))
  assert.deepEqual(failures, [])
  assert.deepEqual(browserErrors, [])
  console.log('PASS Access: branch staff see Orders only, no branch/team/branding calls, no persisted tokens; no browser exceptions')
  }
  await runChecks()
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
