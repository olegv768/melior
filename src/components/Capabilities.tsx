import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import SectionHead from './ui/SectionHead'
import Reveal from './ui/Reveal'
import Icon from './ui/Icon'
import './Capabilities.css'

export default function Capabilities() {
  return (
    <section className="section caps" id="features" aria-labelledby="caps-title">
      <div className="container">
        <SectionHead
          eyebrow="Возможности"
          title={<span id="caps-title">Пять модулей — одна картина бизнеса</span>}
          lead="Каждый модуль отвечает на конкретный вопрос владельца: где тормозит работа, куда уходят деньги, что можно не делать руками и где лежит дополнительная выручка."
        />
        <div className="bento">
          <Reveal className="bento-cell span-4">
            <ProcessIntel />
          </Reveal>
          <Reveal className="bento-cell span-2" delay={0.05}>
            <CostOpt />
          </Reveal>
          <Reveal className="bento-cell span-2">
            <SmartAuto />
          </Reveal>
          <Reveal className="bento-cell span-2" delay={0.05}>
            <RevenueGrowth />
          </Reveal>
          <Reveal className="bento-cell span-2" delay={0.1}>
            <AiRecs />
          </Reveal>
        </div>
        <p className="caps-note muted small">Значения внутри визуализаций — иллюстративные примеры.</p>
      </div>
    </section>
  )
}

function CapHead({ tag, title, text }: { tag: string; title: string; text: string }) {
  return (
    <div className="cap-head">
      <span className="cap-tag mono">{tag}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}

/* ---------- Process Intelligence ---------- */
const STAGES = ['Заявка', 'Подтверждение', 'Сборка заказа', 'Доставка', 'Оплата']

function ProcessIntel() {
  const [fixed, setFixed] = useState(false)
  const reduced = useReducedMotion()
  const queue = fixed ? 1 : 6
  return (
    <div className="cap cap-pi">
      <div className="cap-pi-top">
        <CapHead
          tag="Process Intelligence"
          title="Находит, где застревает работа"
          text="Строит карту процесса по данным и показывает этап, на котором копятся задачи и теряется время."
        />
        <button type="button" className={`btn btn-sm ${fixed ? 'btn-ghost' : 'btn-primary'}`} onClick={() => setFixed((v) => !v)} aria-pressed={fixed}>
          {fixed ? 'Вернуть как было' : 'Устранить узкое место'}
        </button>
      </div>
      <div className="pipe" aria-label={`Процесс из ${STAGES.length} этапов. ${fixed ? 'Узкое место устранено' : 'Узкое место на этапе «Сборка заказа»'}`}>
        {STAGES.map((s, i) => {
          const bottleneck = i === 2
          return (
            <div key={s} className={`pipe-stage ${bottleneck && !fixed ? 'is-bad' : ''} ${bottleneck && fixed ? 'is-good' : ''}`}>
              <div className="pipe-queue" aria-hidden="true">
                {Array.from({ length: bottleneck ? queue : 1 }).map((_, k) => (
                  <motion.i key={k} layout initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: k * 0.04 }} />
                ))}
              </div>
              <div className="pipe-box">
                <span className="pipe-n mono">{String(i + 1).padStart(2, '0')}</span>
                <span>{s}</span>
              </div>
              {i < STAGES.length - 1 && (
                <span className="pipe-link" aria-hidden="true">
                  {!reduced && <span className={`pipe-flow ${bottleneck && !fixed ? 'is-slow' : ''}`} />}
                </span>
              )}
            </div>
          )
        })}
      </div>
      <div className="pi-stats">
        <div>
          <span className="muted small">Время выполнения заказа</span>
          <strong className="num">{fixed ? '2,6 ч' : '4,2 ч'}</strong>
        </div>
        <div>
          <span className="muted small">Заказов в очереди</span>
          <strong className="num">{queue}</strong>
        </div>
        <div>
          <span className="muted small">Причина</span>
          <strong className="pi-cause">{fixed ? 'Сборка по готовому листу' : 'Сборка ждёт ручной проверки остатков'}</strong>
        </div>
      </div>
    </div>
  )
}

/* ---------- Cost Optimization ---------- */
const COSTS = [
  { name: 'Закупки', v: 52, color: '#4c7dff', cut: 'Часть закупок выше спроса' },
  { name: 'Персонал', v: 22, color: '#6d8dff' },
  { name: 'Аренда', v: 11, color: '#8c7fff' },
  { name: 'Списания', v: 7, color: '#f2b45a', cut: 'Можно снизить через FIFO и уценку' },
  { name: 'Сервисы', v: 5, color: '#b2a6ff', cut: 'Дублирующие подписки' },
  { name: 'Прочее', v: 3, color: '#5a6072' },
]

function CostOpt() {
  const [hover, setHover] = useState<number | null>(null)
  const R = 54
  const C = 2 * Math.PI * R
  let acc = 0
  const active = hover !== null ? COSTS[hover] : null
  return (
    <div className="cap">
      <CapHead tag="Cost Optimization" title="Разбирает расходы по статьям" text="Показывает, какие статьи растут быстрее выручки и где есть резерв." />
      <div className="donut-wrap">
        <svg viewBox="0 0 140 140" className="donut" role="img" aria-label="Структура расходов, пример">
          <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="16" />
          {COSTS.map((c, i) => {
            const len = (c.v / 100) * C
            const off = acc
            acc += len
            return (
              <circle
                key={c.name}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={c.color}
                strokeWidth={hover === i ? 20 : 16}
                strokeDasharray={`${len - 1.5} ${C - len + 1.5}`}
                strokeDashoffset={-off}
                transform="rotate(-90 70 70)"
                style={{ transition: 'stroke-width .25s, opacity .25s', opacity: hover === null || hover === i ? 1 : 0.35, cursor: 'pointer' }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            )
          })}
        </svg>
        <div className="donut-center" aria-live="polite">
          <strong className="num">{active ? `${active.v}%` : '100%'}</strong>
          <span>{active ? active.name : 'расходов'}</span>
        </div>
      </div>
      <ul className="cost-list">
        {COSTS.filter((c) => c.cut).map((c) => {
          const i = COSTS.indexOf(c)
          return (
            <li key={c.name}>
              <button type="button" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
                <i style={{ background: c.color }} />
                <span>
                  <b>{c.name}</b> — {c.cut}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ---------- Smart Automation ---------- */
const TASKS = [
  { name: 'Ответы о наличии и ценах', h: 6 },
  { name: 'Напоминания клиентам о записи', h: 3 },
  { name: 'Сверка оплат с кассой', h: 3 },
  { name: 'Заявки поставщикам', h: 4 },
]

function SmartAuto() {
  const [on, setOn] = useState<boolean[]>([true, false, false, false])
  const saved = TASKS.reduce((a, t, i) => a + (on[i] ? t.h : 0), 0)
  return (
    <div className="cap">
      <CapHead tag="Smart Automation" title="Убирает рутину" text="Находит повторяющиеся задачи и предлагает, что можно отдать автоматизации." />
      <ul className="auto-list">
        {TASKS.map((t, i) => (
          <li key={t.name}>
            <label className="switch-row">
              <span>
                {t.name}
                <span className="muted small"> · {t.h} ч/нед</span>
              </span>
              <input
                type="checkbox"
                className="switch"
                checked={on[i]}
                onChange={() => setOn((arr) => arr.map((v, k) => (k === i ? !v : v)))}
              />
            </label>
          </li>
        ))}
      </ul>
      <div className="auto-total">
        <span className="muted small">Освобождается в неделю</span>
        <motion.strong key={saved} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="num">
          ≈ {saved} ч
        </motion.strong>
      </div>
    </div>
  )
}

/* ---------- Revenue Growth ---------- */
const FUNNEL = [
  { name: 'Обращения', v: 100 },
  { name: 'Получили ответ', v: 74 },
  { name: 'Сделали заказ', v: 29 },
  { name: 'Купили повторно', v: 11 },
]

function RevenueGrowth() {
  const [boost, setBoost] = useState(false)
  const vals = boost ? [100, 92, 37, 15] : FUNNEL.map((f) => f.v)
  return (
    <div className="cap">
      <CapHead tag="Revenue Growth" title="Ищет упущенную выручку" text="Показывает, на каком шаге уходят клиенты и что вернёт их в воронку." />
      <div className="funnel">
        {FUNNEL.map((f, i) => (
          <div key={f.name} className="funnel-row">
            <span className="funnel-name">{f.name}</span>
            <div className="funnel-track">
              <motion.span animate={{ width: `${vals[i]}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
            </div>
            <span className="num funnel-v">{vals[i]}</span>
          </div>
        ))}
      </div>
      <label className="switch-row funnel-toggle">
        <span>Ответ за 15 минут и повторное касание</span>
        <input type="checkbox" className="switch" checked={boost} onChange={() => setBoost((v) => !v)} />
      </label>
    </div>
  )
}

/* ---------- AI Recommendations ---------- */
const RECS = [
  { p: 'Высокий', area: 'Склад', text: 'Остановить закупку 12 позиций без продаж 45+ дней и запустить уценку.' },
  { p: 'Высокий', area: 'Продажи', text: 'Отвечать на заявки в WhatsApp в течение 15 минут в рабочие часы — сейчас в среднем 2 ч 40 мин.' },
  { p: 'Средний', area: 'Персонал', text: 'Сдвинуть вторую смену на 2 часа позже — пик продаж приходится на 18:00–21:00.' },
  { p: 'Средний', area: 'Финансы', text: 'Пересмотреть 3 подписки на сервисы, которые дублируют друг друга.' },
]

function AiRecs() {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (paused || reduced) return
    const t = window.setInterval(() => setI((v) => (v + 1) % RECS.length), 4200)
    return () => window.clearInterval(t)
  }, [paused, reduced])
  const r = RECS[i]
  return (
    <div className="cap" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <CapHead tag="AI Recommendations" title="Говорит, что делать дальше" text="Превращает находки в конкретные шаги с приоритетом и ответственной зоной." />
      <div className="rec-stack" aria-live="polite">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={i}
            className="rec-card"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="rec-meta">
              <span className={`chip ${r.p === 'Высокий' ? 'chip-bad' : 'chip-demo'}`}>{r.p} приоритет</span>
              <span className="chip">{r.area}</span>
            </div>
            <p>{r.text}</p>
          </motion.div>
        </AnimatePresence>
        <div className="rec-card rec-ghost" aria-hidden="true" />
      </div>
      <div className="rec-nav">
        <span className="muted small num">
          {i + 1} / {RECS.length}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setI((v) => (v + 1) % RECS.length)}>
          Следующая <Icon name="arrow" size={14} />
        </button>
      </div>
    </div>
  )
}
