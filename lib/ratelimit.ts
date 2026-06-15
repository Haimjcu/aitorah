import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextRequest } from 'next/server'

const hasRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

const redis = hasRedis ? Redis.fromEnv() : null

const chatRateLimit = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m'), prefix: 'rl:chat' })
  : null

const chatDailyLimit = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(50, '1 d'), prefix: 'rl:chat:daily' })
  : null

function getIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? req.headers.get('x-real-ip')
    ?? '127.0.0.1'
}

export async function checkRateLimit(req: NextRequest): Promise<Response | null> {
  if (!chatRateLimit || !chatDailyLimit) return null

  const ip = getIP(req)

  const [perMinute, perDay] = await Promise.all([
    chatRateLimit.limit(ip),
    chatDailyLimit.limit(ip),
  ])

  if (!perMinute.success) {
    return Response.json(
      { error: 'Too many requests. Please wait a moment before trying again.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((perMinute.reset - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(perMinute.limit),
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
          'Retry-After': String(Math.ceil((perDay.reset - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(perDay.limit),
          'X-RateLimit-Remaining': String(perDay.remaining),
        },
      },
    )
  }

  return null
}
