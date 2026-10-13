import { useId } from 'react'

export default function Logo({ size = 28 }: { size?: number }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#4c7dff" />
          <stop offset="1" stopColor="#9b8cff" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="#19213b" stroke="rgba(255,255,255,0.1)" />
      <path
        d="M8 23V12l7 6.5L24 8v15"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
