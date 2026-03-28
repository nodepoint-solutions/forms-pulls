import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'

jest.unstable_mockModule('../../src/config.js', () => ({
  config: { port: 3000, githubToken: 'test', cacheTtlMs: 60000, isDevelopment: false },
}))

const mockWarmPrCache = jest.fn().mockResolvedValue({})
jest.unstable_mockModule('../../src/services/prs.js', () => ({
  warmPrCache: mockWarmPrCache,
  getPRs: jest.fn(),
}))

const mockWarmDependencyCache = jest.fn().mockResolvedValue({})
jest.unstable_mockModule('../../src/services/dependencies/index.js', () => ({
  warmDependencyCache: mockWarmDependencyCache,
  getDependencies: jest.fn(),
}))

const { startScheduler } = await import('../../src/services/scheduler.js')

describe('startScheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockWarmPrCache.mockClear()
    mockWarmDependencyCache.mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('warms cache immediately when skipInitial is false', async () => {
    const stop = startScheduler()
    await Promise.resolve()
    expect(mockWarmPrCache).toHaveBeenCalledTimes(1)
    expect(mockWarmDependencyCache).toHaveBeenCalledTimes(1)
    stop()
  })

  it('skips initial warm when skipInitial is true', async () => {
    const stop = startScheduler({ skipInitial: true })
    await Promise.resolve()
    expect(mockWarmPrCache).toHaveBeenCalledTimes(0)
    expect(mockWarmDependencyCache).toHaveBeenCalledTimes(0)
    stop()
  })

  it('warms cache again after interval', async () => {
    const stop = startScheduler({ skipInitial: true })
    jest.advanceTimersByTime(60000)
    await Promise.resolve()
    expect(mockWarmPrCache).toHaveBeenCalledTimes(1)
    expect(mockWarmDependencyCache).toHaveBeenCalledTimes(1)
    stop()
  })

  it('returned function stops the interval', async () => {
    const stop = startScheduler({ skipInitial: true })
    stop()
    jest.advanceTimersByTime(60000)
    await Promise.resolve()
    expect(mockWarmPrCache).toHaveBeenCalledTimes(0)
    expect(mockWarmDependencyCache).toHaveBeenCalledTimes(0)
    stop()
  })
})
