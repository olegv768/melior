import { useMemo } from 'react'
import SectionHead from './ui/SectionHead'
import Reveal from './ui/Reveal'
import ReportView from './ReportView'
import { buildDemoReport } from '../lib/demoReport'
import './Sections.css'

export default function SampleReport() {
  const report = useMemo(() => buildDemoReport({ businessType: 'cafe', turnover: 't2', problem: 'costs', employees: 9 }), [])
  return (
    <section className="section sample" aria-labelledby="sample-title">
      <div className="container">
        <SectionHead
          eyebrow="Пример отчёта"
          title={<span id="sample-title">Что получает предприниматель</span>}
          lead="Отчёт написан языком владельца бизнеса: что не так, почему это важно и что сделать на этой неделе. Ниже — пример для кафе с 9 сотрудниками."
          aside={
            <span className="chip chip-demo">
              <span className="dot" /> Пример · демо-данные
            </span>
          }
        />
        <Reveal>
          <div className="sample-frame">
            <ReportView report={report} preview />
            <div className="sample-fade" aria-hidden="true" />
          </div>
        </Reveal>
        <div className="sample-cta">
          <a href="#audit" className="btn btn-primary">
            Получить свой отчёт <span className="arrow">→</span>
          </a>
        </div>
      </div>
    </section>
  )
}
