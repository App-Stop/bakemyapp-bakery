export const rowsOf = (data, key) => { const rows = Array.isArray(data) ? data : data?.[key] || data?.items; return Array.isArray(rows) ? rows : [] }
