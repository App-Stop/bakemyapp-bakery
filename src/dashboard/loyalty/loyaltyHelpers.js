import { changes, toMinor } from '../../lib/tenant.js'

export const loyaltyForm = (rules) => ({ walletEnabled: !!rules.walletEnabled, pointsEnabled: !!rules.pointsEnabled, pointsPerMajorUnit: String(rules.pointsPerMajorUnit ?? 0), pointValue: String((rules.pointsValueMinor ?? 0) / 100), streakBonusPoints: String(rules.streakBonusPoints ?? 0) })
export function loyaltyPatch(base, form) {
  const next = { walletEnabled: form.walletEnabled, pointsEnabled: form.pointsEnabled, pointsPerMajorUnit: Number(form.pointsPerMajorUnit), pointsValueMinor: toMinor(form.pointValue), streakBonusPoints: Number(form.streakBonusPoints) }
  if (!String(form.pointsPerMajorUnit).trim() || !Number.isFinite(next.pointsPerMajorUnit) || next.pointsPerMajorUnit < 0 || next.pointsPerMajorUnit > 1000) throw new Error('Points earned must be between 0 and 1,000 per 1.00 spent.')
  if (!String(form.streakBonusPoints).trim() || !Number.isSafeInteger(next.streakBonusPoints) || next.streakBonusPoints < 0) throw new Error('The streak bonus must be a whole number of points, zero or more.')
  return changes(base, next)
}
export function rewardBody(form, original) {
  const body = { title: form.title.trim(), description: form.description.trim() || null, pointsCost: Number(form.pointsCost), sortOrder: Number(form.sortOrder), isActive: form.isActive }
  if (!body.title || !Number.isSafeInteger(body.pointsCost) || body.pointsCost < 1) throw new Error('Enter a reward title and a whole points cost of at least 1.')
  if (!String(form.sortOrder).trim() || !Number.isSafeInteger(body.sortOrder)) throw new Error('Display position must be a whole number.')
  return original ? changes(original, body) : body
}
export function walletCreditBody(amount, reason) {
  const body = { amount: toMinor(amount), reason: reason.trim() }
  if (body.amount < 1) throw new Error('Enter a credit amount greater than zero.')
  if (!body.reason || body.reason.length > 200) throw new Error('Enter a reason of up to 200 characters for the customer.')
  return body
}
