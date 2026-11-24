import assert from 'node:assert/strict'
export function createCommerceFixture() {
  const store = { name: 'Test Bakery', slug: 'test-bakery', status: 'live', contactEmail: 'hello@example.test', contactPhone: null, address: 'Karachi', timezone: 'Asia/Karachi', currencyCode: 'PKR', appName: null, currencySymbol: 'Rs', preset: 'custom', primary: '#C15400', logo: null, businessConfirmed: true, brandingConfirmed: true }
  const hours = { sameForAll: true, hours: Array.from({ length: 7 }, (_, i) => ({ day: i + 1, isClosed: false, opensAt: '09:00', closesAt: '21:00' })), branches: [{ id: 'branch-1', name: 'Clifton', isActive: true }] }; hours.branches[0].hours = hours.hours
  const settings = { acceptDelivery: true, acceptPickup: true, deliveryMinutes: 30, minimumOrder: null, deliveryRadiusKm: null, taxRate: 0, taxLabel: 'Tax', branchesDiffer: { minimumOrder: true, deliveryRadiusKm: true } }
  const preferences = { newOrderAlerts: true, orderStatusUpdates: true, lowStockWarnings: true, dailySalesSummary: false, weeklyAnalyticsReport: true, customerReviews: true }
  const pricing = { taxRate: 0, pricesIncludeTax: false, discountsStack: false, guestCheckoutEnabled: true }
  const customer = { id: 'customer-1', name: 'Ayesha Khan', email: 'ayesha@example.test', phone: null, isActive: true, joinedAt: '2026-10-01T00:00:00Z', orders: 4, spent: 105050, lastOrderAt: null, walletBalance: 1250, pointsBalance: 42 }
  const promos = []
  const steps = []
  const fixture = { failOrders: false, handle({ path, method, body, send, role, url, raw, headers }) {
    const ownerOnly = /^(pricing|promo-codes|order-settings)/.test(path)
    if (ownerOnly) assert.equal(role, 'tenant_owner', `Manager requested ${path}`)
    if (path === 'me') { send({ id: 'user-1', name: 'Owner', email: 'owner@example.test', role, roleName: role, permissions: role === 'tenant_owner' ? ['*'] : role === 'tenant_manager' ? ['orders:view', 'menu:view', 'menu:edit', 'branches:view', 'branches:edit', 'business:view', 'branding:view'] : ['orders:view'], tenant: { name: store.name, status: 'live' } }); return true }
    const pagination = { currentPage: Number(url.searchParams.get('page') || 1), itemsPerPage: 8, totalItems: 9, totalPages: 2 }
    if (path === 'customers') { send(url.searchParams.get('q') === 'nobody' ? [] : [customer], 200, { pagination }); return true }
    if (path === 'customers/customer-1') { send({ ...customer, averageOrder: 26262, cancelledOrders: 1, addresses: [{ id: 'a', addressLine1: 'Street 4', city: 'Karachi' }], favourites: [{ id: 'f', name: 'Cake' }], topProducts: [{ name: 'Cake', quantity: 3 }], recentOrders: [{ number: 1042, status: 'completed', total: 105050, createdAt: '2026-11-23T00:00:00Z' }] }); return true }
    if (path === 'store') { if (method === 'PATCH') { assert.equal(role, 'tenant_owner'); Object.assign(store, body) } send(store); return true }
    if (path === 'store/logo') { assert.equal(role, 'tenant_owner'); if (method === 'POST') { assert.equal(headers['content-type'], 'image/png'); assert.ok(raw.length); store.logo = { url: `data:image/png;base64,${raw.toString('base64')}` } } else store.logo = null; send(store); return true }
    if (path === 'branding/presets') { send([{ id: 'violet', name: 'Violet', primary: '#903BFF', featured: true }]); return true }
    if (path === 'hours') { if (method === 'PUT') { assert.equal(body.hours.length, 7); hours.hours = body.hours; hours.branches[0].hours = body.hours } send(hours); return true }
    if (path === 'order-settings') { if (method === 'PATCH') { if (fixture.failOrders) { fixture.failOrders = false; send({}, 422, { message: 'Review order settings', error: [{ path: 'minimumOrder', message: 'Minimum order is not available right now' }] }); return true } Object.assign(settings, body) } send(settings); return true }
    if (path === 'notification-preferences') { if (method === 'PATCH') Object.assign(preferences, body); send(preferences); return true }
    if (path === 'me/change-password') { assert.deepEqual(Object.keys(body).sort(), ['currentPassword', 'newPassword']); send({ accessToken: 'test-token' }); return true }
    if (path === 'pricing') { if (method === 'PATCH') Object.assign(pricing, body); send(pricing); return true }
    if (path === 'promo-codes') { if (method === 'POST') { const promo = { id: 'promo-1', ...body, uses: 0, isActive: true }; promos.push(promo); send(promo, 201) } else send(promos, 200, { pagination: { ...pagination, totalItems: promos.length, totalPages: 1 } }); return true }
    if (path === 'promo-codes/promo-1') { if (method === 'PATCH') { assert.ok(!('code' in body)); Object.assign(promos[0], body) } if (method === 'DELETE') promos[0].isActive = false; send(promos[0]); return true }
    if (path === 'discounts/quantity') { if (method === 'POST') { assert.equal(!!body.productId + !!body.categoryId, 1); const step = { id: 'step-1', ...body, productName: 'Chocolate Cake', isActive: true }; steps.push(step); send(step, 201) } else send(steps); return true }
    if (path === 'discounts/quantity/step-1') { if (method === 'DELETE') steps.splice(0, 1); else Object.assign(steps[0], body); send(steps[0] || {}); return true }
    return false
  } }
  return fixture
}
