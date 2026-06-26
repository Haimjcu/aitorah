import { NextRequest } from 'next/server'
import { getRedis } from './redis'

function getIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? req.headers.get('x-real-ip')
    ?? '127.0.0.1'
}

async function slidingWindowCheck(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ success: boolean; remaining: number; resetMs: number }> {
  const redis = getRedis()
  if (!redis) return { success: true, remaining: limit, resetMs: 0 }

  const now = Date.now()
  const windowMs = windowSeconds * 1000
  const windowStart = now - windowMs

  const pipeline = redis.pipeline()
  pipeline.zremrangebyscore(key, 0, windowStart)
  pipeline.zadd(key, now, `${now}:${Math.random()}`)
  pipeline.zcard(key)
  pipeline.expire(key, windowSeconds)

  const results = await pipeline.exec()
  const count = (results?.[2]?.[1] as number) ?? 0

  return {
    success: count <= limit,
    remaining: Math.max(0, limit - count),
    resetMs: now + windowMs,
  }
}

export async function checkRateLimit(req: NextRequest): Promise<Response | null> {
  const redis = getRedis()
  if (!redis) return null

  const ip = getIP(req)

  const [perMinute, perDay] = await Promise.all([
    slidingWindowCheck(`rl:chat:min:${ip}`, 10, 60),
    slidingWindowCheck(`rl:chat:day:${ip}`, 50, 86400),
  ])

  if (!perMinute.success) {
    return Response.json(
      { error: 'Too many requests. Please wait a moment before trying again.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((perMinute.resetMs - Date.now()) / 1000)),
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': String(perMinute.remaining),
        },
      },
    )
  }

  if (!perDay.success) {
    return Response.json(
      { error: 'Daily limit reached. Please try again tomorrow or sign in for higher limits.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((perDay.resetMs - Date.now()) / 1000)),
          'X-RateLimit-Limit': '50',
          'X-RateLimit-Remaining': String(perDay.remaining),
        },
      },
    )
  }

  return null
}
