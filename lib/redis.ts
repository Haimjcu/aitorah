import Redis from 'ioredis'

let client: Redis | null = null

export function getRedis(): Redis | null {
  if (client) return client

  const url = process.env.REDIS_URL
  if (!url) return null

  client = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  })

  client.on('error', (err) => {
    console.error('Redis connection error:', err.message)
  })

  return client
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis()
  if (!redis) return null

  try {
    const val = await redis.get(key)
    if (!val) return null
    return JSON.parse(val) as T
  } catch {
    return null
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  } catch {
    // cache write failure is non-critical
  }
}

export async function cacheDel(key: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    await redis.del(key)
  } catch {
    // cache delete failure is non-critical
  }
}

export async function incrViewCount(slug: string): Promise<number> {
  const redis = getRedis()
  if (!redis) return 0

  try {
    return await redis.incr(`views:${slug}`)
  } catch {
    return 0
  }
}
