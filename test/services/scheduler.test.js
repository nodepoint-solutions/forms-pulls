import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'

jest.unstable_mockModule('../../src/config.js', () => ({
  config: { port: 3000, githubToken: 'test', cacheTtlMs: 60000, isDevelopment: false },
}))

const mockGetPRs = jest.fn().mockResolvedValue({})
jest.unstable_mockModule('../../src/services/prs.js', () => ({ getPRs: mockGetPRs }))

const { startScheduler } = await import('../../src/services/scheduler.js')

describe('startScheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockGetPRs.mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('warms cache immediately on start', async () => {
    const stop = startScheduler()
    await Promise.resolve()
    expect(mockGetPRs).toHaveBeenCalledWith({ force: true })
    stop()
  })

  it('warms cache again after interval', async () => {
    const stop = startScheduler()
    await Promise.resolve()
    jest.advanceTimersByTime(60000)
    await Promise.resolve()
    expect(mockGetPRs).toHaveBeenCalledTimes(2)
    stop()
  })

  it('returned function stops the interval', async () => {
    const stop = startScheduler()
    await Promise.resolve()
    stop()
    jest.advanceTimersByTime(60000)
    await Promise.resolve()
    expect(mockGetPRs).toHaveBeenCalledTimes(1)
  })
})
