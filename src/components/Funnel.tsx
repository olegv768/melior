import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { motion } from 'framer-motion'
import { analyseFunnel, funnelWhatIf } from '../../shared/marketplace'
import type { FunnelSummary } from '../../shared/marketplace'
import { downloadText, readWorkbook, sampleFunnelCsv, toNumber } from '../lib/table'
import { fmtCur, fmtInt } from '../lib/format'
import SectionHead from './ui/SectionHead'
import Icon from './ui/Icon'
import AiBlock from './AiBlock'
import './Funnel.css'

type Stage = { id: number; name: string; count: string }

const TEMPLATES: { name: string; stages: string[] }[] = [
  { name: 'Мессенджеры', stages: ['Написали', 'Получили ответ', 'Узнали цену', 'Заказали', 'Оплатили'] },
  { name: 'Сайт / реклама', stages: ['Показы', 'Переходы', 'Заявки', 'Заказы', 'Оплаты'] },
  { name: 'Маркетплейс', stages: ['Просмотры карточки', 'В корзину', 'Заказы', 'Выкуп'] },
  { name: 'Салон / услуги', stages: ['Обращения', 'Записались', 'Пришли', 'Пришли повторно'] },
]

let uid = 0
const mk = (name: string, count = ''): Stage => ({ id: ++uid, name, count })

export default function Funnel() {
  const [stages, setStages] = useState<Stage[]>(() => TEMPLATES[0].stages.map((s) => mk(s)))
  const [avgCheck, setAvgCheck] = useState('')
  const [currency, setCurrency] = useState('₸')
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [result, setResult] = useState<{ name: string; count: number }[] | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const update = (id: number, patch: Partial<Stage>) => {
    setStages((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    setErrors((e) => ({ ...e, [id]: '' }))
    setResult(null)
  }
  const applyTemplate = (t: (typeof TEMPLATES)[number]) => {
    setStages(t.stages.map((s) => mk(s)))
    setErrors({})
    setResult(null)
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setFileError(null)
    try {
      const sheets = await readWorkbook(f)
      const rows = sheets[0]?.rows ?? []
      const parsed = rows
        .map((r) => {
          const name = r.find((c) => typeof c === 'string' && c.trim() && toNumber(c) === null)
          const count = r.map(toNumber).find((n) => n !== null)
          return name && count !== undefined && count !== null ? mk(String(name).trim(), String(Math.round(count))) : null
        })
        .filter((x): x is Stage => x !== null)
      if (parsed.length < 2) throw new Error('нужны минимум две строки «этап — число»')
      setStages(parsed.slice(0, 10))
      setErrors({})
      setResult(null)
    } catch (err) {
      setFileError(`Не удалось прочитать: ${err instanceof Error ? err.message : 'неизвестная ошибка'}`)
    }
  }

  const calculate = () => {
    const errs: Record<number, string> = {}
    const clean = stages.map((s, i) => {
      const n = toNumber(s.count)
      if (!s.name.trim()) errs[s.id] = 'Название этапа'
      else if (n === null || n < 0 || !Number.isInteger(n)) errs[s.id] = 'Целое число ≥ 0'
      else if (i === 0 && n === 0) errs[s.id] = 'Первый этап не может быть 0'
      return { name: s.name.trim(), count: n ?? 0 }
    })
    clean.forEach((s, i) => {
      if (i > 0 && !errs[stages[i].id] && s.count > clean[i - 1].count) errs[stages[i].id] = 'Больше предыдущего этапа'
    })
    setErrors(errs)
    if (Object.keys(errs).length) {
      setResult(null)
      return
    }
    setResult(clean)
  }

  return (
    <section className="section fn" id="funnel" aria-labelledby="fn-title">
      <div className="container">
        <SectionHead eyebrow="Воронка" title={<span id="fn-title">Где теряются клиенты</span>} lead="Введите, сколько людей дошло до каждого этапа, или загрузите таблицу «этап — число»." />

        <div className="fn-wrap">
          <div className="fn-input panel">
            <div className="fn-templates" role="group" aria-label="Шаблоны воронки">
              {TEMPLATES.map((t) => (
                <button key={t.name} type="button" className="pill" onClick={() => applyTemplate(t)}>
                  {t.name}
                </button>
              ))}
            </div>

            <ol className="fn-stages">
              {stages.map((s, i) => (
                <li key={s.id}>
                  <span className="fn-n mono">{i + 1}</span>
                  <input
                    className="fn-name"
                    value={s.name}
                    aria-label={`Название этапа ${i + 1}`}
                    onChange={(e) => update(s.id, { name: e.target.value })}
                  />
                  <input
                    className="fn-count"
                    inputMode="numeric"
                    placeholder="0"
                    value={s.count}
                    aria-label={`Количество на этапе «${s.name}»`}
                    aria-invalid={!!errors[s.id]}
                    onChange={(e) => update(s.id, { count: e.target.value.replace(/[^\d\s]/g, '') })}
                  />
                  <button
                    type="button"
                    className="fn-del"
                    aria-label={`Удалить этап «${s.name}»`}
                    disabled={stages.length <= 2}
                    onClick={() => {
                      setStages((x) => x.filter((y) => y.id !== s.id))
                      setResult(null)
                    }}
                  >
                    <Icon name="minus" size={14} />
                  </button>
                  {errors[s.id] && <span className="field-error fn-err">{errors[s.id]}</span>}
                </li>
              ))}
            </ol>
            <div className="fn-row">
              <button type="button" className="btn btn-ghost btn-sm" disabled={stages.length >= 10} onClick={() => setStages((x) => [...x, mk(`Этап ${x.length + 1}`)])}>
                <Icon name="plus" size={14} /> Этап
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
                Загрузить из Excel / CSV
              </button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt" hidden onChange={onFile} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadText('пример_воронки.csv', sampleFunnelCsv())}>
                Пример
              </button>
            </div>
            {fileError && (
              <p className="mp-error" role="alert">
                <Icon name="alert" size={16} /> {fileError}
              </p>
            )}
            <div className="fn-row fn-check">
              <label>
                <span className="muted small">Средний чек (необязательно)</span>
                <span className="fn-money">
                  <input inputMode="numeric" placeholder="например, 8500" value={avgCheck} onChange={(e) => setAvgCheck(e.target.value.replace(/[^\d\s]/g, ''))} />
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Валюта">
                    {['₸', '₽', '$'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </span>
              </label>
              <button type="button" className="btn btn-primary" onClick={calculate}>
                Рассчитать <span className="arrow">→</span>
              </button>
            </div>
          </div>

          <div className="fn-result panel">
            {result ? (
              <FunnelResult stages={result} avgCheck={toNumber(avgCheck) ?? 0} currency={currency} />
            ) : (
              <div className="fn-empty">
                <span className="muted">Заполните этапы и нажмите «Рассчитать».</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function FunnelResult({ stages, avgCheck, currency }: { stages: { name: string; count: number }[]; avgCheck: number; currency: string }) {
  const a = useMemo(() => analyseFunnel(stages, avgCheck), [stages, avgCheck])
  const [pp, setPp] = useState(10)
  const extra = funnelWhatIf(stages, a.worst, pp)
  const max = stages[0].count || 1
  const worst = a.steps[a.worst]
  const summary: FunnelSummary = { stages, avgCheck: avgCheck || undefined, currency }

  return (
    <div className="fn-res">
      <div className="fn-bars">
        {stages.map((s, i) => {
          const step = i > 0 ? a.steps[i - 1] : null
          const isWorst = step && i - 1 === a.worst
          return (
            <div key={`${s.name}-${i}`} className="fn-bar-row">
              {step && (
                <div className={`fn-conv ${isWorst ? 'is-worst' : ''}`}>
                  ↓ {(step.conv * 100).toFixed(1)}% <span className="muted">· −{fmtInt(step.lost)}</span>
                </div>
              )}
              <div className="fn-bar-line">
                <span className="fn-bar-name">{s.name}</span>
                <span className="fn-bar-val num">{fmtInt(s.count)}</span>
              </div>
              <div className="fn-track">
                <motion.span
                  className={isWorst ? 'is-worst' : ''}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(1.5, (s.count / max) * 100)}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05 }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="fn-kpis">
        <div>
          <span className="muted small">Итоговая конверсия</span>
          <b className="num">{(a.overall * 100).toFixed(2)}%</b>
        </div>
        <div>
          <span className="muted small">Узкое место</span>
          <b className="fn-worst">
            {worst.from} → {worst.to}: {(worst.conv * 100).toFixed(1)}%
          </b>
        </div>
        <div>
          <span className="muted small">Не дошли до конца</span>
          <b className="num">{fmtInt(stages[0].count - stages[stages.length - 1].count)}</b>
        </div>
      </div>

      <div className="fn-whatif">
        <label htmlFor="fn-pp">
          Если поднять «{worst.from} → {worst.to}» на <b className="num">{pp} п.п.</b>
        </label>
        <input id="fn-pp" type="range" min={1} max={30} value={pp} onChange={(e) => setPp(Number(e.target.value))} />
        <p>
          +<b className="num">{fmtInt(extra)}</b> на последнем этапе
          {avgCheck > 0 && (
            <>
              {' '}
              ≈ <b className="num">{fmtCur(extra * avgCheck, currency)}</b> выручки
            </>
          )}
          .
        </p>
      </div>

      <AiBlock key={JSON.stringify(summary)} kind="funnel" getSummary={() => summary} />
    </div>
  )
}
