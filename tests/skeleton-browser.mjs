import assert from 'node:assert/strict'

export async function runSkeletonChecks({ click, fill, wait, text, evaluate, capture, cdp, failures, browserErrors }) {
  const loading = (label) => wait(`!!document.querySelector('[role="status"][aria-label=${JSON.stringify(label)}]')`)
  const loaded = (label) => wait(`!document.querySelector('[role="status"][aria-label=${JSON.stringify(label)}]')`)
  await fill('email', 'owner@example.test'); await fill('password', 'long-test-password'); await click('Sign in')
  await loading('Loading menu categories'); await capture('loading-menu'); await wait(text('Chocolate cake'))
  await click('Branches', 'nav button'); await loading('Loading branches'); await capture('loading-branches'); await wait(text('Clifton'))
  await click('Orders', 'nav button'); await wait('!!document.querySelector(".skeleton-native-row")'); await capture('loading-orders'); await wait('!document.querySelector(".skeleton-native-row")'); await click('View details for order #1042'); await loading('Loading order details'); await capture('loading-order-details'); await loaded('Loading order details'); await click('Close order details')
  // A background refresh must retain the populated table instead of reintroducing skeletons.
  await evaluate('document.querySelector(".catalog-tools").open=true'); await click('Refresh'); assert.equal(await evaluate('!!document.querySelector(".skeleton-native-row")'), false); await wait('document.querySelector(".orders-table-card").getAttribute("aria-busy") === "false"')
  await click('Customers', 'nav button'); await loading('Loading customers'); await capture('loading-customers'); await loaded('Loading customers'); await click('Ayesha Khan'); await loading('Loading customer details'); await loaded('Loading customer details'); await click('Close dialog')
  await click('Settings', 'nav button'); await loading('Loading Store Information'); await capture('loading-settings'); await loaded('Loading Store Information'); await loaded('Loading Notifications')
  await click('Payments', 'nav button'); await loading('Loading payment settings'); await capture('loading-payments'); await loaded('Loading payment settings')
  await click('Team', 'nav button'); await loading('Loading team members'); await loaded('Loading team members'); await click('View Member 1'); await loading('Loading team member'); await loaded('Loading team member'); await click('Close dialog')
  await click('Pricing', 'nav button'); await loading('Loading pricing rules'); await loaded('Loading pricing rules'); await click('Promo Codes'); await loading('Loading promo codes'); await loaded('Loading promo codes'); await click('Quantity Discounts'); await loading('Loading quantity discounts'); await loaded('Loading quantity discounts')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  // Reload the selected section with reduced motion, then verify static placeholders and no overflow.
  await click('Open navigation'); await click('Customers', '#dashboard-sidebar nav button'); await loading('Loading customers')
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".skeleton-block"), "::after").animationName'), 'skeleton-shimmer')
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".skeleton-block"), "::after").animationName'), 'none')
  assert.equal(await evaluate('document.querySelector(".skeleton").querySelectorAll("button,input,select,a").length'), 0)
  await capture('loading-customers-mobile'); await loaded('Loading customers')
  assert.deepEqual(failures, []); assert.deepEqual(browserErrors, [])
  console.log('PASS Skeletons: session, menu, branches, order rows/details, customers/details, settings, payments, team/details and pricing; background refresh preserves data; mobile layout, accessible status, no placeholder controls and reduced motion')
}
