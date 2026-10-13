const PATHS = {
  cafe: 'M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Zm11 1h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M11 3v3M14 3v3',
  shop: 'M4 9l1.5-5h13L20 9M4 9h16M4 9v10h16V9M9 19v-5h6v5',
  salon: 'M7 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm2.2-8.6L20 18M9.2 16.6 20 6',
  company: 'M4 20V7l8-4 8 4v13M9 20v-6h6v6M8 10h.01M12 10h.01M16 10h.01',
  online: 'M3 5h18v11H3zM8 20h8M12 16v4M7 12l3-3 2 2 4-4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  print: 'M7 9V4h10v5M7 17H5v-6h14v6h-2M7 14h10v6H7z',
  refresh: 'M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5',
  alert: 'M12 4 2.5 20h19L12 4Zm0 6v4m0 3h.01',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
  flow: 'M4 6h5v4H4zM15 14h5v4h-5zM9 8h3a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2',
  minus: 'M6 12h12',
  plus: 'M12 6v12M6 12h12',
  arrow: 'M5 12h14M13 6l6 6-6 6',
} as const

export type IconName = keyof typeof PATHS

export default function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
