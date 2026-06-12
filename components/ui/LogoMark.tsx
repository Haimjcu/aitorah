export function LogoMark({ size = 32 }: { size?: number }) {
  const width = Math.round(size * 1.26);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={size}
      viewBox="0 0 88 70"
      fill="currentColor"
      className="flex-shrink-0"
    >
      <path d="M 32 18 C 43 13, 53 13, 63 18 L 63 54 C 53 59, 43 59, 32 54 Z" opacity="0.12"/>
      <path d="M 32 18 C 43 13, 53 13, 63 18" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M 32 54 C 43 59, 53 59, 63 54" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M 32 18 C 29 19, 28 22, 28 25 L 28 47 C 28 50, 29 53, 32 54" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M 63 18 C 66 19, 67 22, 67 25 L 67 47 C 67 50, 66 53, 63 54" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M 20 10 L 6 62 L 34 62 Z M 20 24 L 15 40 L 25 40 Z M 16 46 L 12 62 L 28 62 L 24 46 Z" fillRule="evenodd"/>
      <path d="M 60 10 L 82 10 L 82 17 L 76 17 L 76 55 L 82 55 L 82 62 L 60 62 L 60 55 L 66 55 L 66 17 L 60 17 Z"/>
      <circle cx="20" cy="5" r="3.5"/>
      <circle cx="71" cy="5" r="3.5"/>
      <circle cx="8" cy="66" r="1.5"/>
      <circle cx="32" cy="66" r="1.5"/>
      <circle cx="62" cy="66" r="1.5"/>
      <circle cx="80" cy="66" r="1.5"/>
    </svg>
  )
}
