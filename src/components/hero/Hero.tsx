import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CORE, NODES } from './nodes'
import type { NodeId } from './nodes'
import type { LabelRefs } from './HeroScene'
import { useMediaQuery } from '../../lib/useMediaQuery'
import './Hero.css'

const HeroScene = lazy(() => import('./HeroScene'))

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

const ALL = [CORE, ...NODES]

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] as const },
})

export default function Hero() {
  const reduced = !!useReducedMotion()
  const compact = useMediaQuery('(max-width: 760px)')
  const [active, setActive] = useState<NodeId | null>(null)
  const [running, setRunning] = useState(true)
  const [webgl] = useState(() => (typeof window === 'undefined' ? false : hasWebGL()))
  const stageRef = useRef<HTMLDivElement>(null)
  const labelRefs: LabelRefs = useRef({})
  const pointer = useRef({ x: 0, y: 0 })

  // pause rendering when the hero is off-screen
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => setRunning(e.isIntersecting), { threshold: 0 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // parallax input, normalised to [-1, 1]
  useEffect(() => {
    if (reduced || compact) return
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [reduced, compact])

  const activeNode = useMemo(() => ALL.find((n) => n.id === active) ?? null, [active])

  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="container hero-grid">
        <div className="hero-copy">
          <motion.div {...fade(0.05)}>
            <a href="#upload" className="hero-badge">
              <span className="chip chip-accent">
                <span className="dot" /> Excel · Kaspi · WB · Ozon
              </span>
              <span>Анализ по вашим данным</span>
              <span className="arrow" aria-hidden="true">
                →
              </span>
            </a>
          </motion.div>

          <motion.h1 id="hero-title" {...fade(0.12)}>
            Твой бизнес может работать <span className="grad-text">эффективнее</span>
          </motion.h1>

          <motion.p className="hero-lead" {...fade(0.22)}>
            Находим скрытые потери, оптимизируем процессы и помогаем принимать решения на основе данных. Меньше
            рутины. Больше контроля над прибылью.
          </motion.p>

          <motion.div className="hero-actions" {...fade(0.32)}>
            <a href="#upload" className="btn btn-primary">
              Загрузить таблицу <span className="arrow">→</span>
            </a>
            <a href="#funnel" className="btn btn-ghost">
              Анализ воронки
            </a>
          </motion.div>

          <motion.ul className="hero-facts" {...fade(0.42)}>
            <li>
              <span className="mono">01</span>Excel и CSV: выручка, маржа, ABC
            </li>
            <li>
              <span className="mono">02</span>Kaspi, Wildberries, Ozon по API
            </li>
            <li>
              <span className="mono">03</span>Воронка: где теряются клиенты
            </li>
          </motion.ul>
        </div>

        <motion.div
          className="hero-stage"
          ref={stageRef}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="hero-stage-glow" aria-hidden="true" />
          {webgl ? (
            <Suspense fallback={<div className="hero-loading" aria-hidden="true" />}>
              <HeroScene
                active={active}
                setActive={setActive}
                labelRefs={labelRefs}
                pointer={pointer}
                reduced={reduced}
                compact={compact}
                running={running}
              />
            </Suspense>
          ) : (
            <StaticSystem />
          )}

          {webgl && (
            <div className="hero-labels" role="group" aria-label="Схема бизнес-системы">
              {ALL.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  ref={(el) => {
                    labelRefs.current[n.id] = el
                  }}
                  className={`hero-label side-${n.side} ${n.id === 'core' ? 'is-core' : ''} ${active === n.id ? 'is-active' : ''}`}
                  onMouseEnter={() => setActive(n.id)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(n.id)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive((cur) => (cur === n.id ? null : n.id))}
                  aria-describedby={active === n.id ? 'hero-tip' : undefined}
                >
                  <span className="hero-label-text">{n.label}</span>
                </button>
              ))}
            </div>
          )}

          <AnimatePresence>
            {activeNode && (
              <motion.div
                id="hero-tip"
                role="tooltip"
                className="hero-tip panel"
                key={activeNode.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.22 }}
              >
                <div className="hero-tip-head">
                  <span className="hero-tip-title">{activeNode.label}</span>
                  <span className="chip">{activeNode.id === 'core' ? 'связи' : 'модуль'}</span>
                </div>
                <p>{activeNode.desc}</p>
                <div className="hero-tip-signal">
                  <span className="mono">Сигнал</span>
                  {activeNode.signal}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      </div>
    </section>
  )
}

function StaticSystem() {
  const pts = NODES.map((n) => ({ ...n, x: 200 + n.pos[0] * 62, y: 200 - n.pos[1] * 62 }))
  return (
    <svg className="hero-static" viewBox="0 0 400 400" role="img" aria-label="Схема: ядро анализа, связанное с финансами, продажами, сотрудниками, складом и автоматизацией">
      <defs>
        <radialGradient id="hs-core">
          <stop offset="0" stopColor="#7f9bff" />
          <stop offset="1" stopColor="#1b2338" />
        </radialGradient>
      </defs>
      {pts.map((p) => (
        <line key={p.id} x1={200} y1={200} x2={p.x} y2={p.y} stroke="#4c7dff" strokeOpacity="0.4" />
      ))}
      <circle cx="200" cy="200" r="46" fill="url(#hs-core)" />
      {pts.map((p) => (
        <g key={p.id}>
          <rect x={p.x - 13} y={p.y - 13} width="26" height="26" rx="7" fill="#232838" stroke="#8fa8ff" strokeOpacity="0.4" />
          <text x={p.x} y={p.y + 32} textAnchor="middle" fill="#b4b9c6" fontSize="12">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
