import assert from 'node:assert/strict'

export function createEngagementFixture() {
  const rules = { walletEnabled: false, pointsEnabled: false, pointsPerMajorUnit: 0.01, pointsValueMinor: 100, streakBonusPoints: 5 }
  const customer = { id: 'customer-1', name: 'Ayesha Khan', email: 'ayesha@example.test', joinedAt: '2026-10-01T00:00:00Z', orders: 4, spent: 100000, walletBalance: 1250, pointsBalance: 30, addresses: [], favourites: [], topProducts: [], recentOrders: [] }
  const faqs = [{ id: 'faq-1', question: 'When can I collect my order?', answer: 'We will let you know when it is ready.', sortOrder: 0, isActive: true }]
  const rewards = []
  const tickets = [{ id: 'ticket-1', type: 'missing_points', status: 'open', message: 'I did not receive my points.', customer, order: { number: 1042, total: 25000, currencySymbol: 'Rs' }, image: null, reply: null, createdAt: '2026-11-26T08:00:00Z' }]
  const messages = Array.from({ length: 51 }, (_, index) => ({ id: `message-${index + 1}`, body: `Initial customer message ${index + 1}`, senderType: 'customer', createdAt: new Date(Date.UTC(2026, 10, 26, 5, index)).toISOString() }))
  const streams = new Set()
  const fixture = {
    complete: false, failFaq: false, walletFailure: false, closedTicket: false, streamFailure: null, needsReply: true,
    plan: { plan: { name: 'Growth', description: 'For a growing bakery.', features: ['Multiple locations', 'Customer loyalty'] }, price: { amount: 29900, currency: 'USD', interval: 'month' }, billingInterval: 'month', status: 'trial', trialEndsAt: '2026-12-01T00:00:00Z', currentPeriodEnd: '2026-12-26T00:00:00Z', cancelAtPeriodEnd: false, paymentProblem: true, usage: { branches: { used: 1, limit: 3 }, team: { used: 4 } } },
    emit(body) { const message = { id: `message-${messages.length + 1}`, body, senderType: 'customer', createdAt: new Date().toISOString() }; messages.push(message); fixture.needsReply = true; for (const response of streams) response.write(`event: message\ndata: ${JSON.stringify({ customerId: customer.id, message })}\n\n`); return message },
    disconnect() { for (const response of streams) response.end(); streams.clear() },
    reopenTicket() { tickets[0].status = 'open'; tickets[0].reply = null },
    get streams() { return streams.size },
    handle({ path, method, body, role, url, send, res }) {
      if (path === 'me') { send({ id: 'user-1', name: 'Owner', email: 'owner@example.test', role, roleName: role, permissions: role === 'tenant_owner' ? ['*'] : role === 'tenant_manager' ? ['setup:view', 'branches:view', 'branches:edit', 'business:view', 'branding:view', 'menu:view', 'menu:edit', 'orders:view', 'orders:manage', 'team:view'] : ['orders:view', 'orders:manage'], tenant: { name: 'Test Bakery', status: fixture.complete ? 'live' : 'onboarding' }, branch: role === 'branch_staff' ? { id: 'branch-1', name: 'Clifton' } : null }); return true }
      if (path === 'setup') {
        assert.notEqual(role, 'branch_staff')
        send({ complete: fixture.complete, progress: { done: fixture.complete ? 5 : 3, total: 5, percent: fixture.complete ? 100 : 60 }, items: ['business', 'branding', 'branch', 'menu', 'payments', 'team'].map((key, index) => ({ key, title: ['Business details', 'Branding', 'First branch', 'Your menu', 'Payment methods', 'Invite your team'][index], description: `Review ${key} configuration.`, route: `/${key}`, required: key !== 'team', available: true, done: fixture.complete || index < 3 })).concat([{ key: 'future', title: 'Unavailable future setup', available: false, required: true, done: false }]) }); return true
      }
      if (path === 'plan') { assert.equal(role, 'tenant_owner'); send(fixture.plan); return true }
      if (path === 'customers') { send([customer], 200, { pagination: { currentPage: 1, itemsPerPage: 8, totalPages: 1, totalItems: 1 } }); return true }
      if (path === 'customers/customer-1') { send(customer); return true }
      if (path.startsWith('loyalty')) {
        assert.equal(role, 'tenant_owner', 'Only owners may request loyalty APIs')
        if (path === 'loyalty') { if (method === 'PATCH') Object.assign(rules, body); send(rules); return true }
        if (path === 'loyalty/rewards') { if (method === 'POST') { assert.ok(Number.isInteger(body.pointsCost)); const reward = { id: 'reward-1', ...body }; rewards.push(reward); send(reward, 201) } else send(rewards); return true }
        if (path === 'loyalty/rewards/reward-1') { if (method === 'DELETE') rewards.splice(0); else Object.assign(rewards[0], body); send(rewards[0] || {}); return true }
        if (path.endsWith('/wallet-credit')) { assert.equal(rules.walletEnabled, true); assert.deepEqual(Object.keys(body).sort(), ['amount', 'reason']); assert.ok(Number.isInteger(body.amount) && body.amount > 0); if (fixture.walletFailure) { fixture.walletFailure = false; send({}, 503, { message: 'The credit could not be confirmed.' }); return true } customer.walletBalance += body.amount; send({ walletBalance: customer.walletBalance }); return true }
      }
      if (!path.startsWith('support/')) return false
      assert.ok(['tenant_owner', 'tenant_manager'].includes(role), 'Support APIs are restricted to owners/managers')
      if (path === 'support/faqs') { if (method === 'POST') { if (fixture.failFaq) { fixture.failFaq = false; send({}, 422, { message: 'Review the question', error: [{ path: 'question', message: 'Please make your question more specific.' }] }); return true } const faq = { id: 'faq-2', ...body }; faqs.push(faq); send(faq, 201) } else send(faqs); return true }
      if (path.startsWith('support/faqs/')) { const index = faqs.findIndex((faq) => faq.id === path.split('/')[2]); if (method === 'DELETE') faqs.splice(index, 1); else Object.assign(faqs[index], body); send(faqs[index] || {}); return true }
      if (path === 'support/tickets') { const rows = tickets.filter((ticket) => (!url.searchParams.get('status') || url.searchParams.get('status') === 'all' || ticket.status === url.searchParams.get('status')) && (!url.searchParams.get('type') || ticket.type === url.searchParams.get('type'))); send(rows, 200, { pagination: { currentPage: Number(url.searchParams.get('page') || 1), itemsPerPage: 10, totalPages: 1, totalItems: rows.length } }); return true }
      if (path === 'support/tickets/ticket-1') { send(tickets[0]); return true }
      if (path.endsWith('/reply')) { if (fixture.closedTicket) { fixture.closedTicket = false; tickets[0].status = 'closed'; send({}, 422, { message: 'ticket_closed' }); return true } assert.equal(tickets[0].status, 'open'); tickets[0].status = 'closed'; tickets[0].reply = body.reply; send(tickets[0]); return true }
      if (path === 'support/chats/stream') {
        if (fixture.streamFailure) { const status = fixture.streamFailure; fixture.streamFailure = null; send({}, status, { message: status === 429 ? 'Too many live connections. Try reconnecting later.' : 'Token expired' }); return true }
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }); res.flushHeaders(); res.write('event: ready\ndata: {}\n\n'); streams.add(res); res.on('close', () => streams.delete(res)); return true
      }
      if (path === 'support/chats') { send([{ customerId: customer.id, customer, needsReply: fixture.needsReply, lastMessage: messages.at(-1), lastMessageAt: messages.at(-1).createdAt }], 200, { pagination: { currentPage: 1, itemsPerPage: 10, totalPages: 1, totalItems: 1 } }); return true }
      if (path === 'support/chats/customer-1') { const after = url.searchParams.get('after'); const index = after ? messages.findIndex((message) => message.id === after) + 1 : 0; send({ customer, messages: messages.slice(index, index + Number(url.searchParams.get('limit') || 50)) }); return true }
      if (path.endsWith('/messages')) { messages.push({ id: `message-${messages.length + 1}`, body: body.body, senderType: 'bakery', createdAt: new Date().toISOString() }); fixture.needsReply = false; send(messages.at(-1), 201); return true }
      return false
    },
  }
  return fixture
}
