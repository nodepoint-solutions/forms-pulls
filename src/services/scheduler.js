import { getPRs } from './prs.js'
import { config } from '../config.js'

export function startScheduler() {
  let running = false

  const warm = async () => {
    if (running) return
    running = true
    try {
      await getPRs({ force: true })
    } catch (err) {
      console.error('Scheduler: cache warm failed —', err.message)
    } finally {
      running = false
    }
  }

  warm()

  const id = setInterval(warm, config.cacheTtlMs)

  return () => clearInterval(id)
}
