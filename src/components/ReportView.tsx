import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { AuditItem, AuditReport } from '../../shared/audit'
import { reportToText } from '../lib/auditClient'
import { fmtMoneyRange } from '../lib/format'
import Icon from './ui/Icon'

const SEV: Record<string, { label: string; cls: string }> = {
  high: { label: 'важно', cls: 'chip-bad' },
  medium: { label: 'средне', cls: 'chip-demo' },
  low: { label: 'низко', cls: '' },
}

type Props = {
  report: AuditReport
  onReset?: () => void
  /** static preview, without actions */
  preview?: boolean
}

export default function ReportView({ report, onReset, preview }: Props) {
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null)

  const flash = (ok: boolean, text: string) => {
    setToast({ ok, text })
    window.setTimeout(() => setToast(null), 2600)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportToText(report))
      flash(true, 'Отчёт скопирован')
    } catch {
      flash(false, 'Не удалось скопировать — браузер запретил доступ к буферу')
    }
  }

  return (
    <article className={`report panel ${preview ? 'is-preview' : ''}`} aria-label="Отчёт по бизнесу">
      <header className="report-head">
        <div className="report-meta">
          {report.mode === 'ai' ? (
            <span className="chip chip-accent">
              <Icon name="spark" size={13} /> ИИ-анализ · Gemini
            </span>
          ) : (
            <span className="chip chip-demo">
              <span className="dot" /> Демонстрационный режим
            </span>
          )}
          <span className="muted small">Первичный аудит · {new Date().toLocaleDateString('ru-RU')}</span>
        </div>
        {report.mode === 'demo' && !preview && (
          <p className="report-notice">
            ИИ на этом сайте сейчас не подключён. Отчёт собран из заранее подготовленных сценариев по вашим ответам — это пример
            формата, а не анализ ваших данных.
          </p>
        )}
        {report.mode === 'ai' && (
          <p className="report-notice is-ai">
            Отчёт сгенерирован ИИ по ответам анкеты, без доступа к вашим реальным данным. Проверяйте выводы перед внедрением.
          </p>
        )}
        <div className="report-top">
          <p className="report-summary">{report.summary}</p>
          <div className="report-save">
            <span className="muted small">Ориентир экономии в месяц</span>
            <strong className="num">
              {fmtMoneyRange(report.savings.low, report.savings.high)}
            </strong>
            <span className="muted small">{report.savings.note}</span>
          </div>
        </div>
      </header>

      <div className="report-grid">
        <Block n="01" title="Возможные проблемные места" items={report.problems} severity />
        <Block n="02" title="Процессы для оптимизации" items={report.processes} />
        <Block n="03" title="Направления сокращения расходов" items={report.costs} />
        <Block n="04" title="Рекомендуемые автоматизации" items={report.automations} />
      </div>

      <section className="plan" aria-label="План действий на 30 дней">
        <h4>
          <span className="mono muted">05</span> План действий на 30 дней
        </h4>
        <ol className="plan-grid">
          {report.plan.map((w, i) => (
            <motion.li
              key={w.week}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
            >
              <span className="plan-week mono">Неделя {w.week}</span>
              <span className="plan-title">{w.title}</span>
              <ul>
                {w.tasks.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </motion.li>
          ))}
        </ol>
      </section>

      {!preview && (
        <footer className="report-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
            <Icon name="copy" size={16} /> Скопировать отчёт
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()}>
            <Icon name="print" size={16} /> Распечатать / PDF
          </button>
          {onReset && (
            <button type="button" className="btn btn-primary btn-sm" onClick={onReset}>
              Новый анализ
            </button>
          )}
        </footer>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            className={`toast ${toast.ok ? 'is-ok' : 'is-bad'}`}
            role="status"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <Icon name={toast.ok ? 'check' : 'alert'} size={16} /> {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  )
}

function Block({ n, title, items, severity }: { n: string; title: string; items: AuditItem[]; severity?: boolean }) {
  return (
    <section className="report-block">
      <h4>
        <span className="mono muted">{n}</span> {title}
      </h4>
      <ul>
        {items.map((it) => (
          <li key={it.title}>
            <div className="rb-title">
              <span>{it.title}</span>
              {severity && it.severity && <span className={`chip ${SEV[it.severity].cls}`}>{SEV[it.severity].label}</span>}
            </div>
            <p>{it.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
