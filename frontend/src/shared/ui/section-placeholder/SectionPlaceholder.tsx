import type { LucideIcon } from 'lucide-react'
import { ArrowRight } from 'lucide-react'
import { Button } from '../button/Button'
import './SectionPlaceholder.css'

interface SectionPlaceholderProps {
  eyebrow: string
  title: string
  description: string
  icon: LucideIcon
}

export function SectionPlaceholder({ eyebrow, title, description, icon: Icon }: SectionPlaceholderProps) {
  return (
    <main className="section-placeholder page-shell" id="main-content">
      <section className="section-placeholder__card" aria-labelledby="section-title">
        <span className="section-placeholder__icon"><Icon size={34} strokeWidth={2.3} aria-hidden="true" /></span>
        <p className="section-placeholder__eyebrow">{eyebrow}</p>
        <h1 id="section-title">{title}</h1>
        <p className="section-placeholder__description">{description}</p>
        <Button to="/">
          Explorar oportunidades
          <ArrowRight size={21} aria-hidden="true" />
        </Button>
      </section>
    </main>
  )
}
