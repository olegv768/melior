import { useEffect, useRef, useState } from 'react'
import { animate, useInView, useReducedMotion } from 'framer-motion'

type Props = {
  value: number
  format?: (n: number) => string
  duration?: number
}

const defaultFormat = (n: number) => Math.round(n).toLocaleString('ru-RU')

export default function CountUp({ value, format = defaultFormat, duration = 1.2 }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' })
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(0)
  const from = useRef(0)

  useEffect(() => {
    if (!inView) return
    if (reduce) {
      setShown(value)
      from.current = value
      return
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(v),
      onComplete: () => {
        from.current = value
      },
    })
    return () => {
      from.current = value
      controls.stop()
    }
  }, [inView, value, duration, reduce])

  return (
    <span ref={ref} className="num">
      {format(shown)}
    </span>
  )
}
