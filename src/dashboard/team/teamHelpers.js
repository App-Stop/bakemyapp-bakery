import { can, changes } from '../../lib/tenant.js'

export const canManageMember = (user, member) => can(user, 'team:manage') && (member.role !== 'tenant_owner' || user.role === 'tenant_owner')
export const canChangeAccess = (user, member) => canManageMember(user, member) && user.id !== member.id
export const when = (value) => value ? new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Karachi' }) : 'Never'

export function memberPatch(member, form, roles, user) {
  const next = { name: form.name.trim() }
  if (canChangeAccess(user, member)) {
    next.role = form.role
    if (roles.find((role) => role.key === form.role)?.requiresBranch) next.branchId = form.branchId
  }
  const patch = changes({ ...member, branchId: member.branch?.id }, next)
  // A change between branch roles requires the branch in the same request.
  if (patch.role && next.branchId) patch.branchId = next.branchId
  return patch
}

export function invitationBody(form, roles) {
  return { email: form.email.trim(), ...(form.name.trim() ? { name: form.name.trim() } : {}), role: form.role,
    ...(roles.find((role) => role.key === form.role)?.requiresBranch ? { branchId: form.branchId } : {}) }
}
