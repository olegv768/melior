import Logo from './ui/Logo'
import { NAV, SITE } from '../config'
import './Sections.css'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <a href="#top" className="nav-logo" aria-label="Melior — наверх">
            <Logo />
            <span>Melior</span>
          </a>
          <p className="muted small">Аналитика и оптимизация процессов для малого и среднего бизнеса.</p>
        </div>
        <nav aria-label="Навигация в подвале" className="footer-col">
          <span className="footer-h">Разделы</span>
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`}>
              {n.label}
            </a>
          ))}
          <a href="#audit">AI Business Audit</a>
        </nav>
        <div className="footer-col">
          <span className="footer-h">Контакты</span>
          <a href={SITE.repo} target="_blank" rel="noreferrer">
            GitHub проекта ↗
          </a>
          <span>{SITE.city}</span>
          <span className="muted">{SITE.event}</span>
        </div>
      </div>
      <div className="container footer-bottom">
        <span className="muted small">© {new Date().getFullYear()} Melior. Проект хакатона.</span>
        <span className="muted small">Все цифры на сайте — демонстрационные примеры.</span>
      </div>
    </footer>
  )
}
