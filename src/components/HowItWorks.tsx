import { useRef } from 'react'
import { motion, useScroll, useSpring } from 'framer-motion'
import SectionHead from './ui/SectionHead'
import Reveal from './ui/Reveal'
import './Sections.css'

const STEPS = [
  {
    title: 'Данные',
    text: 'Опишите бизнес в анкете или загрузите то, что уже есть: выгрузку из кассы, таблицу, банковскую выписку.',
    tags: ['Excel / CSV', 'Касса', 'Выписка банка', 'Анкета'],
  },
  {
    title: 'Модель процессов',
    text: 'Melior сопоставляет продажи, расходы, остатки и загрузку сотрудников и строит картину того, как бизнес работает на самом деле.',
    tags: ['Продажи', 'Расходы', 'Остатки', 'Смены'],
  },
  {
    title: 'Поиск потерь',
    text: 'Находит отклонения: перерасход по статьям, простои, залежавшийся товар, упущенные продажи и ручные операции.',
    tags: ['Аномалии', 'Узкие места', 'Причины'],
  },
  {
    title: 'План действий',
    text: 'Рекомендации с приоритетом и план на 30 дней. Повторный анализ через месяц показывает, что изменилось.',
    tags: ['Приоритеты', 'План на 30 дней', 'Контроль эффекта'],
  },
]

export default function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 80%', 'end 60%'] })
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })

  return (
    <section className="section how" id="how" aria-labelledby="how-title">
      <div className="container">
        <SectionHead
          eyebrow="Как это работает"
          title={<span id="how-title">От данных к рекомендациям</span>}
          lead="Не нужно внедрять новую учётную систему. Melior работает с тем, что у бизнеса уже есть, и превращает это в конкретные решения."
        />
        <div className="how-wrap" ref={ref}>
          <div className="how-line" aria-hidden="true">
            <motion.span style={{ scaleX: progress }} />
          </div>
          <ol className="how-steps">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 0.08} className="how-step">
                <span className="how-n mono">{String(i + 1).padStart(2, '0')}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
                <div className="how-tags">
                  {s.tags.map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
