import * as cache from '../services/cache.js'

const ALLOWED = ['/', '/all', '/stale', '/unreviewed', '/needs-re-review']

function safeRedirect(referrer) {
  try {
    const path = new URL(referrer, 'http://localhost').pathname
    return ALLOWED.includes(path) ? path : '/'
  } catch { return '/' }
}

export default {
  method: 'POST', path: '/refresh',
  handler(request, h) {
    const path = safeRedirect(request.headers.referer || '/')
    if (cache.isCooldown()) return h.redirect(`${path}?cooldown=1`)
    cache.clear()
    return h.redirect(path)
  },
}
