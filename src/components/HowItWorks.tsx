import { useRef } from 'react'
import { motion, useScroll, useSpring } from 'framer-motion'
import SectionHead from './ui/SectionHead'
import Reveal from './ui/Reveal'
import './Sections.css'

const STEPS = [
  { title: 'Загрузите', text: 'Excel, CSV или ключ маркетплейса.', tags: ['xlsx', 'csv', 'Kaspi', 'WB', 'Ozon'] },
  { title: 'Проверьте колонки', text: 'Дату, товар и сумму находим сами.', tags: ['Дата', 'Товар', 'Сумма'] },
  { title: 'Получите анализ', text: 'Выручка, маржа, ABC, отмены, пики.', tags: ['ABC', 'Маржа', 'Клиенты'] },
  { title: 'Действуйте', text: 'Конкретные шаги от ИИ по вашим цифрам.', tags: ['ИИ', 'Приоритеты'] },
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
          title={<span id="how-title">Четыре шага</span>}
          lead="Без регистрации и интеграций."
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
