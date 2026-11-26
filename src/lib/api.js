const API_URL = (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '')
const TIMEOUT_MS = 20000

const GENERIC_MESSAGE = 'Something went wrong. Please try again.'
const NETWORK_MESSAGE = 'We could not reach our servers. Check your connection and try again.'

export class ApiError extends Error {
  constructor(message, { status = 0, fieldErrors = {} } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors // { email: 'Enter a valid email address', ... }
  }
}

/** Status codes whose `message` is written for visitors; anything else gets a generic message. */
const shownStatus = (status) => status >= 400 && status < 500

export function createApiClient({ baseUrl = API_URL, fetcher = (...args) => fetch(...args), onSessionExpired = () => {} } = {}) {
  let accessToken = null
  let refreshPromise = null
  const setToken = (token) => { accessToken = token }
  const refresh = () => {
    if (!refreshPromise) {
      refreshPromise = request('/v1/tenant/auth/refresh', { method: 'POST', authenticated: false })
        .then((json) => { setToken(json.data.accessToken); return json })
        .catch((error) => { setToken(null); if (error.status === 401 || error.status === 403) onSessionExpired(); throw error })
        .finally(() => { refreshPromise = null })
    }
    return refreshPromise
  }
  async function request(path, { method = 'GET', body, signal, headers = {}, authenticated = path.startsWith('/v1/tenant/'), retry = true, stream = false } = {}) {
    if (!baseUrl) throw new ApiError('Set VITE_API_URL to your backend address.')
    const sentToken = accessToken
  
    // Abort on the caller's signal or after TIMEOUT_MS, whichever comes first, and tell them apart.
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, TIMEOUT_MS)
    const forwardAbort = () => controller.abort()
    if (signal?.aborted) controller.abort()
    else signal?.addEventListener('abort', forwardAbort, { once: true })
  
    try {
      let response
      try {
        const raw = typeof Blob !== 'undefined' && body instanceof Blob
        response = await fetcher(`${baseUrl}${path}`, {
          method,
          credentials: 'include',
          headers: { ...(body !== undefined ? { 'Content-Type': raw ? body.type : 'application/json' } : {}), ...(authenticated && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...headers },
          body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
          signal: stream && signal ? AbortSignal.any([controller.signal, signal]) : controller.signal,
        })
      } catch (error) {
        if (error.name === 'AbortError' && !timedOut) throw error
        throw new ApiError(timedOut ? 'Our servers are taking too long to answer. Please try again.' : NETWORK_MESSAGE)
      }
  
      if (stream && response.ok) {
        if (!response.headers.get('Content-Type')?.includes('text/event-stream') || !response.body) throw new ApiError('Live chat could not connect. Please reconnect.')
        return response
      }
      let json = null
      try {
        json = await response.json()
      } catch (error) {
        if (error.name === 'AbortError' && !timedOut) throw error
        // not JSON (for example a gateway error page)
      }
  
      if (response.status === 401 && authenticated && retry) {
        if (!accessToken || accessToken === sentToken) await refresh()
        return request(path, { method, body, signal, headers, authenticated, retry: false, stream })
      }
      if (!response.ok || !json || json.success !== true) {
        const fieldErrors = {}
        for (const item of Array.isArray(json?.error) ? json.error : []) {
          if (item?.path && item.message) fieldErrors[item.path] ??= item.message
        }
        const message = (shownStatus(response.status) || response.status === 503) && typeof json?.message === 'string' ? json.message : GENERIC_MESSAGE
        if (response.status === 401 && authenticated) { setToken(null); onSessionExpired() }
        throw new ApiError(message, { status: response.status, fieldErrors })
      }
      return json
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', forwardAbort)
    }
  }
  
  return {
    get: (path, options) => request(path, options),
    post: (path, body, options) => request(path, { method: 'POST', body, ...options }),
    patch: (path, body, options) => request(path, { method: 'PATCH', body, ...options }),
    put: (path, body, options) => request(path, { method: 'PUT', body, ...options }),
    delete: (path, options) => request(path, { method: 'DELETE', ...options }),
    stream: (path, options) => request(path, { ...options, stream: true, headers: { Accept: 'text/event-stream', ...options?.headers } }),
    refresh,
    setToken,
  }
  }
  
  export const api = createApiClient({ onSessionExpired: () => window.dispatchEvent(new Event('tenant-session-expired')) })
