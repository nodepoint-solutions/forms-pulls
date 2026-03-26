import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'

describe('config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, GITHUB_TOKEN: 'test-token' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('reads PORT from env, defaulting to 3000', async () => {
    delete process.env.PORT
    const { config } = await import('../../src/config.js?v=' + Math.random())
    expect(config.port).toBe(3000)
  })

  it('reads PORT from env when set', async () => {
    process.env.PORT = '4000'
    const { config } = await import('../../src/config.js?v=' + Math.random())
    expect(config.port).toBe(4000)
  })

  it('throws if GITHUB_TOKEN is missing', async () => {
    delete process.env.GITHUB_TOKEN
    await expect(import('../../src/config.js?v=' + Math.random())).rejects.toThrow(/GITHUB_TOKEN/)
  })
})
