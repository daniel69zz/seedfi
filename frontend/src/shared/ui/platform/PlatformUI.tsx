import type { PropsWithChildren, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight, FileText, Inbox } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn'
import { formatDate } from '../../lib/format'
import { Button } from '../button/Button'
import './PlatformUI.css'

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="page-header__eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-header__description">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  )
}

export function MetricCard({ label, value, detail, icon: Icon, tone = 'mint' }: { label: string; value: string; detail?: string; icon: LucideIcon; tone?: 'mint' | 'blue' | 'peach' | 'lavender' }) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <span className="metric-card__icon"><Icon size={22} aria-hidden="true" /></span>
      <p>{label}</p>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  )
}

export function SectionCard({ title, description, actions, className, children }: PropsWithChildren<{ title?: string; description?: string; actions?: ReactNode; className?: string }>) {
  return (
    <section className={cn('section-card', className)}>
      {(title || description || actions) && (
        <header className="section-card__header">
          <div>
            {title && <h2>{title.trim().replace(/^refer\s+/i, '')}</h2>}
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="section-card__actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

const dangerWords = ['REJECTED', 'RECHAZADA', 'FAILED', 'DEFAULTED', 'LATE', 'VENCIDO', 'ACTION_REQUIRED']
const warningWords = ['PENDING', 'PENDIENTE', 'UNDER_REVIEW', 'EN REVISIÓN', 'CHANGES_REQUESTED', 'RETRASADO', 'SUBMITTED']
const successWords = ['VERIFIED', 'VALIDADA', 'VALIDADO', 'COMPLETED', 'COMPLETADO', 'CONFIRMADA', 'DISTRIBUTED', 'APPROVED', 'PUBLISHED', 'ACTIVE']

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const normalized = status.toUpperCase()
  const tone = dangerWords.some((word) => normalized.includes(word))
    ? 'danger'
    : warningWords.some((word) => normalized.includes(word))
      ? 'warning'
      : successWords.some((word) => normalized.includes(word))
        ? 'success'
        : 'neutral'
  return <span className={`status-badge status-badge--${tone}`}>{label ?? status.replaceAll('_', ' ')}</span>
}

export function ProgressMeter({ value, label, compact = false }: { value: number; label?: string; compact?: boolean }) {
  const safeValue = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('progress-meter', compact && 'progress-meter--compact')}>
      {label && <div className="progress-meter__label"><span>{label}</span><strong>{safeValue}%</strong></div>}
      <div className="progress-meter__track" role="progressbar" aria-label={label ?? 'Progreso'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeValue}>
        <span style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  )
}

export function Tabs<Value extends string>({ value, options, onChange, label }: { value: Value; options: Array<{ value: Value; label: string }>; onChange: (value: Value) => void; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" role="tab" aria-selected={value === option.value} className={value === option.value ? 'tabs__item tabs__item--active' : 'tabs__item'} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ title, description, actionLabel, actionTo }: { title: string; description: string; actionLabel?: string; actionTo?: string }) {
  return (
    <div className="empty-state">
      <span><Inbox size={30} aria-hidden="true" /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && actionTo && <Button to={actionTo}>{actionLabel}<ArrowRight size={19} /></Button>}
    </div>
  )
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; to?: string }> }) {
  return (
    <nav className="breadcrumbs" aria-label="Migas de pan">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
          {index < items.length - 1 && <b aria-hidden="true">/</b>}
        </span>
      ))}
    </nav>
  )
}

export function DocumentCard({ name, type, date, status, onView, onDownload }: { name: string; type: string; date: string; status: string; onView: () => void; onDownload: () => void }) {
  return (
    <article className="document-card">
      <span className="document-card__icon"><FileText size={22} aria-hidden="true" /></span>
      <div className="document-card__copy"><strong>{name}</strong><span>{type} · {formatDate(date)}</span></div>
      <StatusBadge status={status} />
      <div className="document-card__actions">
        <button type="button" onClick={onView}>Ver</button>
        <button type="button" onClick={onDownload}>Descargar</button>
      </div>
    </article>
  )
}

export function InfoGrid({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="info-grid">
      {items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
    </dl>
  )
}
