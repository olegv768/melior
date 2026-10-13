import Reveal from './ui/Reveal'
import './Sections.css'

export default function FinalCTA() {
  return (
    <section className="section cta" aria-labelledby="cta-title">
      <div className="container">
        <Reveal>
          <div className="cta-card">
            <div className="cta-grid" aria-hidden="true" />
            <div className="cta-orbit" aria-hidden="true">
              <span />
              <span />
            </div>
            <span className="eyebrow">Начните сегодня</span>
            <h2 id="cta-title">
              Узнайте, где ваш бизнес <br className="br-desk" />
              теряет деньги и время
            </h2>
            <p>Загрузите таблицу — анализ займёт секунды.</p>
            <div className="cta-actions">
              <a href="#upload" className="btn btn-primary">
                Загрузить таблицу <span className="arrow">→</span>
              </a>
              <a href="#funnel" className="btn btn-ghost">
                Анализ воронки
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
