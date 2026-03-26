const {
  PORT = '3000',
  GITHUB_TOKEN,
  CACHE_TTL_MS = '300000',
  NODE_ENV = 'production',
} = process.env

if (!GITHUB_TOKEN) {
  throw new Error('GITHUB_TOKEN environment variable is required')
}

export const config = {
  port: parseInt(PORT, 10),
  githubToken: GITHUB_TOKEN,
  cacheTtlMs: parseInt(CACHE_TTL_MS, 10),
  isDevelopment: NODE_ENV === 'development',
}
