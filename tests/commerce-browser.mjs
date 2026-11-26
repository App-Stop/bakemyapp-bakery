import assert from 'node:assert/strict'
export async function runCommerceChecks({ click, fill, wait, text, evaluate, cdp, capture, awaitRequest, requests, failures, browserErrors, fixture }) {
  const select = async (label, value) => { await evaluate(`(()=>{const e=[...document.querySelectorAll('label')].find(e=>e.textContent.startsWith(${JSON.stringify(label)})).querySelector('select');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`); await new Promise((resolve) => setTimeout(resolve, 80)) }
  const login = async (email) => { await fill('email', email); await fill('password', 'long-test-password'); await click('Sign in'); await wait('!!document.querySelector("#dashboard-sidebar")') }
  const logout = async () => { await evaluate(`document.querySelector('#dashboard-sidebar > div.relative > button').click()`); await click('Sign out'); await wait(text('Welcome back')) }
  await login('owner@example.test')
  await click('Customers', 'nav button'); await wait(text('Ayesha Khan')); await capture('customers-desktop')
  await click('Ayesha Khan'); await wait(text('Saved addresses')); await wait(text('Street 4')); await click('Close dialog')
  await click('Next'); await wait(text('Showing 9')); assert.equal((await awaitRequest('GET', 'customers', (request) => request.params.page === '2')).params.page, '2')
  await select('Sort customers', 'spent'); await fill('q', 'nobody'); await wait(text('No customers found.')); assert.equal((await awaitRequest('GET', 'customers')).params.sort, 'spent'); await fill('q', 'Ayesha'); await wait(text('Ayesha Khan'))
  await click('Settings', 'nav button'); await wait('!!document.querySelector("input[name=name]")'); await wait(text('Weekly analytics report'))
  assert.equal(await evaluate('!!document.querySelector(".settings-layout > .settings-sidebar") && !!document.querySelector(".settings-layout > .settings-content")'), true)
  assert.equal(await evaluate('[...document.querySelectorAll("#dashboard-sidebar nav button")].some(e => e.textContent.includes("Promo & Discounts"))'), false)
  await capture('settings-desktop')
  await click('Change'); await wait(text('Choose a preset or a custom color')); await click('Done')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await capture('settings-mobile')
  await click('Business Hours', '.settings-sidebar button'); await wait(`document.querySelector('.settings-sidebar [data-section="business-hours"]').getAttribute('aria-current') === 'true'`); await wait(`document.querySelector('#business-hours').getBoundingClientRect().top <= document.querySelector('.settings-sidebar').getBoundingClientRect().bottom + 24`); await capture('settings-hours-mobile')
  await click('Store Information', '.settings-sidebar button')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1024, height: 1000, deviceScaleFactor: 1, mobile: false }); await capture('settings-tablet')
  assert.equal(await evaluate('document.querySelector("main").scrollWidth <= document.querySelector("main").clientWidth'), true, 'Settings must fit the tablet main column')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  const beforeSave = requests.length
  await click('Save Changes'); await wait(text('Settings saved.')); assert.equal(requests.slice(beforeSave).some((r) => r.method === 'PATCH'), false)
  await fill('name', 'Fresh Bakery'); await fill('minimumOrder', '10.50'); await click('New order alerts'); fixture.failOrders = true
  await click('Save Changes'); await wait(text('Some sections could not be saved.')); await wait(text('Minimum order is not available right now'))
  assert.deepEqual((await awaitRequest('PATCH', 'store')).body, { name: 'Fresh Bakery' }); assert.deepEqual((await awaitRequest('PATCH', 'notification-preferences')).body, { newOrderAlerts: false })
  await click('Save Changes'); await wait(text('Settings saved.')); assert.deepEqual((await awaitRequest('PATCH', 'order-settings')).body, { minimumOrder: 1050 })
  await click('Monday open'); await click('Save Changes'); await awaitRequest('PUT', 'hours'); assert.deepEqual((await awaitRequest('PUT', 'hours')).body.hours[0], { day: 1, isClosed: true })
  await fill('currentPassword', 'old-password-value'); await fill('newPassword', 'a new secure password 123'); await fill('confirmation', 'a new secure password 123'); await click('Change password'); await wait(text('Password changed.'))
  await evaluate(`(()=>{const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#903BFF';ctx.fillRect(0,0,64,64);return new Promise(resolve=>canvas.toBlob(blob=>{const input=document.querySelector('input[type=file]');const files=new DataTransfer();files.items.add(new File([blob],'logo.png',{type:'image/png'}));input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));resolve(true)},'image/png'))})()`)
  await wait(text('Logo saved.')); await click('Remove logo'); await awaitRequest('DELETE', 'store/logo')
  await capture('settings-saved-desktop')
  await click('Pricing', 'nav button'); await wait(text('Prices already include tax')); await click('Prices already include tax'); await click('Save pricing rules'); await wait(text('Prices already include tax')); assert.deepEqual((await awaitRequest('PATCH', 'pricing')).body, { pricesIncludeTax: true })
  await click('Promo Codes'); await click('Create promo code'); await fill('code', 'BAKE10'); await select('Discount type', 'fixed'); await fill('value', '10.50'); await fill('minOrder', '20'); await click('Save promo code'); await wait(text('Promo code saved.'))
  assert.equal((await awaitRequest('POST', 'promo-codes')).body.value, 1050)
  await click('Edit BAKE10'); await wait('!!document.querySelector("input[name=code]:disabled")'); await fill('description', 'A weekend treat'); await click('Save promo code'); await awaitRequest('PATCH', 'promo-codes/promo-1'); assert.equal('code' in (await awaitRequest('PATCH', 'promo-codes/promo-1')).body, false)
  await evaluate('window.confirm=()=>true'); await click('Switch off'); await awaitRequest('DELETE', 'promo-codes/promo-1'); await wait(text('Off')); await click('Switch on'); await wait(text('Active'))
  await capture('pricing-desktop')
  await click('Quantity Discounts'); await click('Add discount step'); await wait('document.querySelectorAll(".dash-sheet select option").length > 3'); await select('Product or category', 'product-1'); await fill('percentOff', '10'); await click('Save discount step'); await wait(text('Chocolate Cake')); assert.deepEqual((await awaitRequest('POST', 'discounts/quantity')).body, { productId: 'product-1', minQuantity: 2, percentOff: 10 })
  await click('Switch off'); await awaitRequest('PATCH', 'discounts/quantity/step-1'); await wait(text('Off')); await click('Switch on'); await wait(text('Active'))
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await capture('pricing-mobile')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }); await logout()
  const managerStart = requests.length
  await login('manager@example.test'); await click('Settings', 'nav button'); await wait(text('Only the owner can change store information.')); assert.equal(await evaluate('document.querySelector("input[name=name]").matches(":disabled")'), true); assert.equal(await evaluate('!!document.querySelector("#order-settings")'), false)
  await click('Tuesday open'); await click('Save Changes'); await wait(text('Settings saved.')); await click('Pricing', 'nav button'); await wait(text('Quantity Discounts')); assert.equal(await evaluate('document.body.innerText.includes("Pricing Rules")'), false); assert.equal(await evaluate('document.body.innerText.includes("Promo Codes")'), false)
  assert.equal(requests.slice(managerStart).some((r) => /^(pricing|promo-codes|order-settings)/.test(r.path)), false)
  assert.deepEqual(failures, []); assert.deepEqual(browserErrors, [])
  console.log('PASS Commerce: customer details/search/sort/pagination, changed-only settings, partial failure recovery, money conversion, full-week hours, password rotation, pricing, promo creation/edit, quantity discounts, manager restrictions and responsive screenshots')
}
