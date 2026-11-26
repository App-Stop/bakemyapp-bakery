import assert from 'node:assert/strict'

export function createAccountsReportingFixture() {
  let name = 'Bakery Owner'
  const productAudit = { id: 'audit-product', action: 'menu.product_updated', actor: { type: 'user', name: 'Demo Bakery Owner' }, createdAt: '2026-11-24T18:31:58.713Z', changes: { unit: { from: null, to: '1 kg' }, isNew: { from: false, to: true }, calories: { from: null, to: 420 }, allergens: { from: [], to: ['dairy', 'eggs', 'gluten'] }, ingredients: { from: [], to: ['Cocoa', 'Butter', 'Eggs', 'Flour'] } } }
  const fixture = {
    failReport: false, emptyReport: false,
    user(role) { return { id: 'user-1', name, email: 'owner@example.test', role, roleName: role, permissions: role === 'tenant_owner' ? ['*'] : role === 'tenant_manager' ? ['menu:view', 'menu:edit', 'orders:view', 'orders:manage', 'branches:view', 'branches:edit', 'business:view', 'branding:view'] : role === 'rider' ? ['deliveries:manage'] : ['orders:view', 'orders:manage'], tenant: { name: 'Test Bakery', status: 'live' }, branch: ['branch_staff', 'rider'].includes(role) ? { id: 'branch-1', name: 'Clifton' } : null } },
    public({ path, body, headers, send, setSession }) {
      if (!['auth/accept-invite', 'auth/forgot-password', 'auth/reset-password'].includes(path)) return false
      assert.equal(headers.authorization, undefined, 'Public account requests must omit existing bearer tokens')
      if (path === 'auth/forgot-password') { assert.deepEqual(Object.keys(body), ['email']); send({}); return true }
      if (body.token === 'expired') { send({}, 400, { message: 'Link expired' }); return true }
      if (body.password === 'common-password') { send({}, 422, { message: 'Choose a stronger password', error: [{ path: 'password', message: 'This password is too common.' }] }); return true }
      assert.ok(body.password.length >= 12)
      assert.equal('confirmation' in body, false)
      if (path === 'auth/reset-password') { assert.deepEqual(Object.keys(body).sort(), ['password', 'token']); setSession(false, 'tenant_owner'); send({}); return true }
      const role = body.token === 'manager-invite' ? 'tenant_manager' : body.token === 'branch-invite' ? 'branch_staff' : body.token === 'rider-invite' ? 'rider' : 'tenant_owner'
      if (body.name) name = body.name
      setSession(true, role); send({ accessToken: 'test-token', user: fixture.user(role) }, 201); return true
    },
    protected({ path, method, body, role, url, send }) {
      if (path === 'me') {
        if (method === 'PATCH') {
          assert.deepEqual(Object.keys(body), ['name'])
          if (body.name === 'Reject name') { send({}, 422, { message: 'Review your name', error: [{ path: 'name', message: 'Choose another display name.' }] }); return true }
          name = body.name
        }
        send(fixture.user(role)); return true
      }
      if (!['overview', 'analytics', 'audit-logs'].includes(path)) return false
      assert.ok(['tenant_owner', 'tenant_manager'].includes(role))
      if (path === 'audit-logs') {
        assert.equal(role, 'tenant_owner', 'Managers must not request the owner activity log')
        send([{ id: 'audit-1', action: 'business.updated', actor: { type: 'staff', name: 'Private operator name' }, changes: { name: { from: 'Old Bakery', to: 'Test Bakery' } }, createdAt: '2026-11-26T08:00:00Z' }, { id: 'audit-2', action: 'custom.future_action', actor: { type: 'system' }, changes: { unknown: { from: null, to: '<script>unsafe</script>' } }, createdAt: '2026-11-26T07:00:00Z' }, productAudit], 200, { pagination: { totalPages: 1, currentPage: 1, totalItems: 3 } }); return true
      }
      if (path === 'overview') {
        send({ today: { orders: 8, sales: 123450, averageOrder: 15431, ordersChange: -10, salesChange: null }, activeOrders: { total: 3, placed: 1, ready: 2 }, customers: { total: 91, newToday: 2, newThisWeek: 7 }, support: { openRequests: 4, chatsNeedingReply: 2 }, lastSevenDays: [{ date: '2026-11-26', orders: 8, sales: 123450 }], topProducts: [{ name: 'Live Croissant', quantity: 12, sales: 123450 }], recentOrders: [{ id: 'order-1', number: 1042, customerName: 'Ayesha', branchName: 'Clifton', placedAt: '2026-11-26T08:00:00Z', total: 40000, status: 'placed' }] }); return true
      }
      if (fixture.failReport) { fixture.failReport = false; send({}, 429, { message: 'Reports are busy. Please try again shortly.' }); return true }
      const from = url.searchParams.get('from'), to = url.searchParams.get('to')
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(from)); assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(to))
      assert.ok((new Date(to) - new Date(from)) / 86400000 < 366)
      assert.ok(['day', 'week', 'month'].includes(url.searchParams.get('groupBy')))
      const empty = fixture.emptyReport
      send({ range: { from, to }, groupBy: url.searchParams.get('groupBy'), totals: { sales: empty ? 0 : 654321, orders: empty ? 0 : 42, averageOrder: empty ? 0 : 15579, salesChange: empty ? null : -12, ordersChange: 5 }, customers: { new: empty ? 0 : 9, returning: empty ? 0 : 15 }, series: empty ? [] : [{ period: from, sales: 50000, orders: 5 }, { period: to, sales: 654321, orders: 37 }], topProducts: empty ? [] : [{ name: 'Live Croissant', quantity: 12, sales: 654321 }], byBranch: empty ? [] : [{ name: 'Clifton', sales: 654321 }], byFulfilment: empty ? [] : [{ fulfilment: 'delivery', orders: 30, sales: 500000 }, { fulfilment: 'pickup', orders: 12, sales: 154321 }], byPaymentMethod: empty ? [] : [{ paymentMethod: 'cod', sales: 654321 }], byStatus: empty ? [] : [{ status: 'completed', orders: 40 }, { status: 'cancelled', orders: 2 }], busiestHours: empty ? [] : [{ hour: 11, orders: 20 }], promos: empty ? [] : [{ code: 'LIVE10', sales: 123400, discountGiven: 12340, uses: 3 }] }); return true
    },
  }
  return fixture
}
