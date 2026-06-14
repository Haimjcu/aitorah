'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[]
  }
}

export function GoogleAnalytics() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const url = pathname + (searchParams.toString() ? '?' + searchParams.toString() : '')
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: 'pageview',
      page: url,
    })
  }, [pathname, searchParams])

  return null
}
