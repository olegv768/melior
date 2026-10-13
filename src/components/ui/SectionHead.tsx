import type { ReactNode } from 'react'
import Reveal from './Reveal'

type Props = {
  eyebrow: string
  title: ReactNode
  lead?: ReactNode
  aside?: ReactNode
}

export default function SectionHead({ eyebrow, title, lead, aside }: Props) {
  return (
    <div className="section-head-row">
      <Reveal className="section-head">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {lead && <p>{lead}</p>}
      </Reveal>
      {aside && <Reveal delay={0.1}>{aside}</Reveal>}
    </div>
  )
}
