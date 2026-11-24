import test from 'node:test'
import assert from 'node:assert/strict'
import { canChangeAccess, canManageMember, invitationBody, memberPatch } from '../src/dashboard/team/teamHelpers.js'

const owner = { id: 'owner', role: 'tenant_owner', permissions: ['*'] }
const manager = { id: 'manager', role: 'tenant_manager', permissions: ['team:view', 'team:manage'] }
const member = { id: 'member', name: 'Ali', role: 'branch_staff', branch: { id: 'branch-1' } }
const roles = [{ key: 'tenant_manager', requiresBranch: false }, { key: 'branch_staff', requiresBranch: true }, { key: 'rider', requiresBranch: true }]

test('team controls protect owners and self access, while allowing own name edits', () => {
  assert.equal(canManageMember(manager, owner), false)
  assert.equal(canManageMember(manager, member), true)
  assert.equal(canManageMember({ permissions: ['team:view'] }, member), false)
  assert.equal(canChangeAccess(owner, owner), false)
  assert.deepEqual(memberPatch(owner, { name: 'New name', role: 'rider', branchId: 'branch-1' }, roles, owner), { name: 'New name' })
})

test('member edits omit unchanged fields and include a branch with every change to a branch role', () => {
  assert.deepEqual(memberPatch(member, { name: ' Ali ', role: 'branch_staff', branchId: 'branch-1' }, roles, owner), {})
  assert.deepEqual(memberPatch(member, { name: 'Ali', role: 'rider', branchId: 'branch-1' }, roles, owner), { role: 'rider', branchId: 'branch-1' })
  assert.deepEqual(memberPatch(member, { name: 'Ali', role: 'branch_staff', branchId: 'branch-2' }, roles, owner), { branchId: 'branch-2' })
  assert.deepEqual(memberPatch(member, { name: 'Ali', role: 'tenant_manager', branchId: 'branch-1' }, roles, owner), { role: 'tenant_manager' })
})

test('invitations omit optional blank names and branches for bakery-wide roles', () => {
  assert.deepEqual(invitationBody({ email: ' ali@example.test ', name: ' ', role: 'tenant_manager', branchId: 'stale' }, roles), { email: 'ali@example.test', role: 'tenant_manager' })
  assert.deepEqual(invitationBody({ email: 'ali@example.test', name: ' Ali ', role: 'rider', branchId: 'branch-1' }, roles), { email: 'ali@example.test', name: 'Ali', role: 'rider', branchId: 'branch-1' })
})
