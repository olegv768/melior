import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'

export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

type Series = { name: string; values: number[]; color: string; area?: boolean; dashed?: boolean }

type AreaChartProps = {
  series: Series[]
  labels: string[]
  height?: number
  format: (n: number) => string
  ariaLabel: string
}

const smoothPath = (pts: [number, number][]) => {
  if (pts.length < 2) return ''
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    const cx = (x0 + x1) / 2
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`
  }
  return d
}

export function AreaChart({ series, labels, height = 240, format, ariaLabel }: AreaChartProps) {
  const [ref, { width }] = useSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const gid = useId()
  const pad = { t: 16, r: 8, b: 26, l: 8 }
  const n = labels.length
  const all = series.flatMap((s) => s.values)
  const max = Math.max(...all) * 1.1
  const min = Math.min(...all) * 0.75
  const w = Math.max(0, width - pad.l - pad.r)
  const h = height - pad.t - pad.b
  const x = (i: number) => pad.l + (n === 1 ? 0 : (i / (n - 1)) * w)
  const y = (v: number) => pad.t + h - ((v - min) / (max - min)) * h

  const paths = useMemo(
    () =>
      series.map((s) => {
        const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number])
        const line = smoothPath(pts)
        const area = `${line} L${x(n - 1)},${pad.t + h} L${x(0)},${pad.t + h} Z`
        return { line, area }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, width, height],
  )

  const onMove = (clientX: number) => {
    const el = ref.current
    if (!el || n < 2) return
    const rect = el.getBoundingClientRect()
    const rel = (clientX - rect.left - pad.l) / w
    setHover(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))))
  }

  return (
    <div
      ref={ref}
      className="chart"
      style={{ height }}
      onMouseMove={(e) => onMove(e.clientX)}
      onTouchMove={(e) => onMove(e.touches[0].clientX)}
      onMouseLeave={() => setHover(null)}
      role="img"
      aria-label={ariaLabel}
    >
      {width > 0 && (
        <svg width={width} height={height}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={i} id={`${gid}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity="0.28" />
                <stop offset="1" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={pad.l}
              x2={pad.l + w}
              y1={pad.t + h * f}
              y2={pad.t + h * f}
              stroke="rgba(255,255,255,0.05)"
            />
          ))}
          {series.map((s, i) => (
            <g key={s.name}>
              {s.area && (
                <motion.path
                  d={paths[i].area}
                  fill={`url(#${gid}-${i})`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8 }}
                />
              )}
              <motion.path
                d={paths[i].line}
                fill="none"
                stroke={s.color}
                strokeWidth={s.area ? 2 : 1.5}
                strokeDasharray={s.dashed ? '4 5' : undefined}
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
              />
            </g>
          ))}
          {labels.map((l, i) =>
            i % Math.ceil(n / 6) === 0 || i === n - 1 ? (
              <text key={i} x={x(i)} y={height - 6} fill="#7d8394" fontSize="11" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
                {l}
              </text>
            ) : null,
          )}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + h} stroke="rgba(255,255,255,0.18)" />
              {series.map((s) => (
                <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r={4} fill="#131a2f" stroke={s.color} strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <div
          className="chart-tip"
          style={{
            left: Math.min(Math.max(x(hover), 80), width - 80),
          }}
        >
          <div className="chart-tip-label">{labels[hover]}</div>
          {series.map((s) => (
            <div key={s.name} className="chart-tip-row">
              <span className="dot" style={{ color: s.color }} />
              <span>{s.name}</span>
              <b className="num">{format(s.values[hover])}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type BarPair = { label: string; a: number; b: number }

export function PairBars({
  data,
  aLabel,
  bLabel,
  aColor,
  bColor,
  format,
}: {
  data: BarPair[]
  aLabel: string
  bLabel: string
  aColor: string
  bColor: string
  format: (n: number) => string
}) {
  const max = Math.max(...data.flatMap((d) => [d.a, d.b])) * 1.05
  return (
    <div className="pairbars">
      <div className="pairbars-legend">
        <span>
          <i style={{ background: aColor }} /> {aLabel}
        </span>
        <span>
          <i style={{ background: bColor }} /> {bLabel}
        </span>
      </div>
      <div className="pairbars-grid" role="list">
        {data.map((d) => {
          const gap = d.a - d.b
          return (
            <div className="pairbars-col" key={d.label} role="listitem" aria-label={`${d.label}: ${aLabel} ${format(d.a)}, ${bLabel} ${format(d.b)}`}>
              <div className="pairbars-bars">
                <motion.span
                  className="pairbars-bar"
                  style={{ background: aColor }}
                  initial={false}
                  animate={{ height: `${(d.a / max) * 100}%` }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
                <motion.span
                  className="pairbars-bar"
                  style={{ background: bColor }}
                  initial={false}
                  animate={{ height: `${(d.b / max) * 100}%` }}
                  transition={{ duration: 0.7, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <div className="pairbars-label">{d.label}</div>
              <div className={`pairbars-gap num ${gap > d.b * 0.15 ? 'is-bad' : ''}`}>
                {gap > 0 ? `+${format(gap)}` : format(gap)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
