import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BUSINESS_TYPES, DETAILS_MAX, PROBLEMS, TURNOVERS, validateInput } from '../../shared/audit'
import type { AuditInput, AuditReport, BusinessType, Problem, Turnover } from '../../shared/audit'
import { AuditError, ERROR_TEXT, runAudit } from '../lib/auditClient'
import { buildDemoReport } from '../lib/demoReport'
import Reveal from './ui/Reveal'
import Icon from './ui/Icon'
import ReportView from './ReportView'
import Ledger from './Ledger'
import type { LedgerPlan } from './Ledger'
import './Audit.css'

type Form = {
  businessType: BusinessType | ''
  turnover: Turnover | ''
  problem: Problem | ''
  employees: string
  details: string
}

type Phase =
  | { name: 'form' }
  | { name: 'running'; stage: number }
  | { name: 'done'; report: AuditReport }
  | { name: 'error'; message: string; input: AuditInput }

const EMPTY: Form = { businessType: '', turnover: '', problem: '', employees: '', details: '' }

const STAGES = ['Сбор информации', 'Анализ процессов', 'Выявление узких мест', 'Подготовка рекомендаций']

const FIELD_ORDER = ['businessType', 'turnover', 'problem', 'employees', 'details'] as const

/** Numbers carried over from the analysed notebook; `key` changes on every hand-over. */
export type AuditPrefill = { key: number; turnover?: Turnover; problem?: Problem; details?: string }

type Mode = 'ledger' | 'audit'

/** Unified «Аудит»: notebook photo recognition or 4-question express audit. */
export default function Audit({ prefill: externalPrefill }: { prefill?: AuditPrefill } = {}) {
  const [mode, setMode] = useState<Mode>(externalPrefill ? 'audit' : 'ledger')
  const [prefill, setPrefill] = useState<AuditPrefill | undefined>(externalPrefill)

  const toPlan = (p: LedgerPlan) => {
    setPrefill({ ...p, key: Date.now() })
    setMode('audit')
  }

  return (
    <div className="ws-body sb">
      <div className="sb-switch" role="tablist" aria-label="Формат аудита">
        {(
          [
            { id: 'ledger', icon: 'camera', title: 'Есть тетрадь', sub: 'Сфотографируйте записи' },
            { id: 'audit', icon: 'form', title: 'Записей нет', sub: 'Ответьте на 4 вопроса' },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            className={mode === m.id ? 'is-on' : ''}
            onClick={() => setMode(m.id)}
          >
            {mode === m.id && <motion.span layoutId="sb-pill" className="sb-pill" />}
            <Icon name={m.icon} size={20} />
            <span>
              <b>{m.title}</b>
              <span>{m.sub}</span>
            </span>
          </button>
        ))}
      </div>

      <div hidden={mode !== 'ledger'}>
        <Ledger onPlan={toPlan} />
      </div>
      <div hidden={mode !== 'audit'}>
        <AuditForm prefill={prefill} />
      </div>
    </div>
  )
}

export function AuditForm({ prefill }: { prefill?: AuditPrefill }) {
  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [phase, setPhase] = useState<Phase>({ name: 'form' })
  const reduced = useReducedMotion()
  const topRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    if (!prefill) return
    abortRef.current?.abort()
    setPhase({ name: 'form' })
    setErrors({})
    setForm((f) => ({
      ...f,
      turnover: prefill.turnover ?? f.turnover,
      problem: prefill.problem ?? f.problem,
      details: (prefill.details ?? f.details).slice(0, DETAILS_MAX),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.key])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }))
  }

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })

  async function analyse(input: AuditInput) {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setPhase({ name: 'running', stage: 0 })
    scrollTop()

    const stepMs = reduced ? 150 : 950
    let stage = 0
    const timer = window.setInterval(() => {
      stage = Math.min(stage + 1, STAGES.length - 1)
      setPhase((p) => (p.name === 'running' ? { name: 'running', stage } : p))
    }, stepMs)
    const minTime = new Promise((r) => setTimeout(r, stepMs * STAGES.length))

    try {
      const [report] = await Promise.all([runAudit(input, ctrl.signal), minTime])
      if (ctrl.signal.aborted) return
      setPhase({ name: 'done', report })
    } catch (err) {
      if (ctrl.signal.aborted) return
      if (err instanceof AuditError && err.kind === 'invalid_input' && err.fields) {
        setErrors(err.fields)
        setPhase({ name: 'form' })
        return
      }
      const kind = err instanceof AuditError ? err.kind : 'ai_failed'
      const info = err instanceof AuditError && err.message !== kind ? ` (${err.message})` : ''
      setPhase({ name: 'error', message: ERROR_TEXT[kind] + info, input })
    } finally {
      window.clearInterval(timer)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const result = validateInput({
      ...form,
      employees: form.employees.trim() === '' ? NaN : Number(form.employees),
    })
    if (!result.ok) {
      setErrors(result.errors)
      const first = FIELD_ORDER.find((k) => result.errors[k])
      if (first) document.getElementById(`f-${first}`)?.focus()
      return
    }
    setErrors({})
    analyse(result.value)
  }

  const reset = () => {
    abortRef.current?.abort()
    setPhase({ name: 'form' })
    scrollTop()
  }

  const stepEmployees = (d: number) => {
    const n = Number(form.employees) || 0
    set('employees', String(Math.max(1, Math.min(5000, n + d))))
  }

  const filled = [form.businessType, form.turnover, form.problem, form.employees].filter(Boolean).length

  return (
    <div className="audit-flow" ref={topRef}>
      {prefill && phase.name === 'form' && (
        <p className="audit-prefilled">
          <Icon name="check" size={16} /> Цифры из тетради уже подставлены. Выберите тип бизнеса и число сотрудников — и получите план.
        </p>
      )}

      <AnimatePresence mode="wait">
        {phase.name === 'form' && (
          <motion.div key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }}>
            <Reveal>
              <form className="audit-form panel" onSubmit={onSubmit} noValidate>
                <div className="audit-progress" aria-hidden="true">
                  <span style={{ width: `${(filled / 4) * 100}%` }} />
                </div>

                <fieldset className="field" aria-describedby={errors.businessType ? 'e-businessType' : undefined}>
                  <legend>
                    <span className="field-n mono">01</span> Тип бизнеса
                  </legend>
                  <div className="tiles" role="radiogroup" aria-invalid={!!errors.businessType}>
                    {BUSINESS_TYPES.map((b, i) => (
                      <label key={b.id} className={`tile ${form.businessType === b.id ? 'is-on' : ''}`}>
                        <input
                          id={i === 0 ? 'f-businessType' : undefined}
                          type="radio"
                          name="businessType"
                          value={b.id}
                          checked={form.businessType === b.id}
                          onChange={() => set('businessType', b.id)}
                        />
                        <Icon name={b.id} size={22} />
                        <span>{b.label}</span>
                      </label>
                    ))}
                  </div>
                  {errors.businessType && <FieldError id="e-businessType" text={errors.businessType} />}
                </fieldset>

                <fieldset className="field" aria-describedby={errors.turnover ? 'e-turnover' : undefined}>
                  <legend>
                    <span className="field-n mono">02</span> Примерный оборот в месяц
                  </legend>
                  <div className="pills" role="radiogroup">
                    {TURNOVERS.map((t, i) => (
                      <label key={t.id} className={`pill ${form.turnover === t.id ? 'is-on' : ''}`}>
                        <input
                          id={i === 0 ? 'f-turnover' : undefined}
                          type="radio"
                          name="turnover"
                          value={t.id}
                          checked={form.turnover === t.id}
                          onChange={() => set('turnover', t.id)}
                        />
                        {t.label}
                      </label>
                    ))}
                  </div>
                  {errors.turnover && <FieldError id="e-turnover" text={errors.turnover} />}
                </fieldset>

                <fieldset className="field" aria-describedby={errors.problem ? 'e-problem' : undefined}>
                  <legend>
                    <span className="field-n mono">03</span> Главная проблема
                  </legend>
                  <div className="pills" role="radiogroup">
                    {PROBLEMS.map((p, i) => (
                      <label key={p.id} className={`pill ${form.problem === p.id ? 'is-on' : ''}`}>
                        <input
                          id={i === 0 ? 'f-problem' : undefined}
                          type="radio"
                          name="problem"
                          value={p.id}
                          checked={form.problem === p.id}
                          onChange={() => set('problem', p.id)}
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                  {errors.problem && <FieldError id="e-problem" text={errors.problem} />}
                </fieldset>

                <div className="field-row">
                  <div className="field">
                    <label className="legend" htmlFor="f-employees">
                      <span className="field-n mono">04</span> Количество сотрудников
                    </label>
                    <div className={`stepper ${errors.employees ? 'is-invalid' : ''}`}>
                      <button type="button" aria-label="Уменьшить" onClick={() => stepEmployees(-1)}>
                        <Icon name="minus" size={16} />
                      </button>
                      <input
                        id="f-employees"
                        inputMode="numeric"
                        placeholder="например, 8"
                        value={form.employees}
                        onChange={(e) => set('employees', e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                        aria-invalid={!!errors.employees}
                        aria-describedby={errors.employees ? 'e-employees' : undefined}
                      />
                      <button type="button" aria-label="Увеличить" onClick={() => stepEmployees(1)}>
                        <Icon name="plus" size={16} />
                      </button>
                    </div>
                    {errors.employees && <FieldError id="e-employees" text={errors.employees} />}
                  </div>

                  <div className="field">
                    <label className="legend" htmlFor="f-details">
                      <span className="field-n mono">05</span> Коротко о бизнесе <span className="muted">— необязательно</span>
                    </label>
                    <textarea
                      id="f-details"
                      rows={3}
                      maxLength={DETAILS_MAX}
                      placeholder="Например: магазин у дома, учёт в тетради"
                      value={form.details}
                      onChange={(e) => set('details', e.target.value)}
                      aria-invalid={!!errors.details}
                      aria-describedby={errors.details ? 'e-details' : 'c-details'}
                    />
                    <div className="field-foot">
                      {errors.details ? <FieldError id="e-details" text={errors.details} /> : <span />}
                      <span id="c-details" className="muted small num">
                        {form.details.length}/{DETAILS_MAX}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="audit-submit">
                  <p className="muted small">
                    Без персональных данных клиентов.
                  </p>
                  <button type="submit" className="btn btn-primary">
                    Начать анализ <span className="arrow">→</span>
                  </button>
                </div>
                {Object.values(errors).some(Boolean) && (
                  <p className="form-summary" role="alert">
                    <Icon name="alert" size={16} /> Заполните отмеченные поля
                  </p>
                )}
              </form>
            </Reveal>
          </motion.div>
        )}

        {phase.name === 'running' && (
          <motion.div
            key="running"
            className="audit-running panel"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            role="status"
            aria-live="polite"
          >
            <div className="scan" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <h3>Анализируем бизнес</h3>
            <ol className="stages">
              {STAGES.map((s, i) => (
                <li key={s} className={i < phase.stage ? 'is-done' : i === phase.stage ? 'is-on' : ''}>
                  <span className="stage-mark">{i < phase.stage ? <Icon name="check" size={14} /> : <i />}</span>
                  {s}
                </li>
              ))}
            </ol>
            <div className="stage-bar">
              <motion.span animate={{ width: `${((phase.stage + 1) / STAGES.length) * 100}%` }} transition={{ duration: 0.6 }} />
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
              Отменить
            </button>
          </motion.div>
        )}

        {phase.name === 'error' && (
          <motion.div key="error" className="audit-error panel" role="alert" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <span className="audit-error-icon">
              <Icon name="alert" size={22} />
            </span>
            <h3>Не удалось получить отчёт</h3>
            <p>{phase.message}</p>
            <div className="audit-error-actions">
              <button type="button" className="btn btn-primary" onClick={() => analyse(phase.input)}>
                <Icon name="refresh" size={16} /> Повторить
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setPhase({ name: 'done', report: buildDemoReport(phase.input) })}>
                Показать демо-отчёт
              </button>
              <button type="button" className="btn btn-ghost" onClick={reset}>
                Изменить ответы
              </button>
            </div>
          </motion.div>
        )}

        {phase.name === 'done' && (
          <motion.div key="done" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
            <ReportView report={phase.report} onReset={reset} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FieldError({ id, text }: { id: string; text: string }) {
  return (
    <span id={id} className="field-error">
      {text}
    </span>
  )
}
