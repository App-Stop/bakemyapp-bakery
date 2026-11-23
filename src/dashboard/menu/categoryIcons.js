export const categoryIcons = [
  { id: 'donut', name: 'Donuts', file: '4bb6b' },
  { id: 'biscuit', name: 'Biscuits', file: '109fd' },
  { id: 'cupcake', name: 'Cupcakes', file: '998d9' },
  { id: 'cake', name: 'Cakes', file: '3c095' },
  { id: 'coffee', name: 'Coffee', file: '8465b' },
  { id: 'bread', name: 'Bread', file: 'fa6c6' },
  { id: 'croissant', name: 'Croissants', file: 'b2f2b' },
]

const storageKey = (scope, id) => `bake-category-icon:${scope}:${id}`
export function categoryIcon(category, scope) {
  let saved
  try { saved = localStorage.getItem(storageKey(scope, category.id)) } catch { /* Use the category name when storage is unavailable. */ }
  return categoryIcons.find((icon) => icon.id === saved) || categoryIcons.find((icon) => category.name?.toLowerCase().includes(icon.id)) || categoryIcons.find((icon) => icon.id === 'croissant')
}
