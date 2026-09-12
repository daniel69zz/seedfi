import { ProgressMeter, SectionCard } from '../../../shared/ui/platform/PlatformUI'

export function ProjectProgress({ progress }: { progress: number }) {
  const safeProgress = Math.round(Math.max(0, Math.min(100, progress)))
  return (
    <SectionCard title="Avance del proyecto" className="investment-progress">
      <div className="investment-progress__row">
        <ProgressMeter value={safeProgress} />
        <strong aria-hidden="true">{safeProgress}%</strong>
      </div>
    </SectionCard>
  )
}
