import Image from 'next/image'

export function LogoMark({ size = 32, variant = 'dark' }: { size?: number; variant?: 'dark' | 'light' }) {
  const width = Math.round(size * (120 / 128))
  const src = variant === 'light' ? '/logo-light.png' : '/logo.png'
  return (
    <Image
      src={src}
      alt="AI Torah"
      width={width}
      height={size}
      className="flex-shrink-0"
    />
  )
}
