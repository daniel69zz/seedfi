import { useId, type ComponentType } from 'react'
import { getProjectGrowthStage, normalizeProjectProgress, type ProjectGrowthStage } from '../model/projectGrowth'
import './ProjectGrowth.css'

type StageProps = { progress: number }

export function SeedStage({ progress }: StageProps) {
  const gradientId = useId()
  const leavesOpacity = Math.min(1, progress / 40)

  return (
    <svg viewBox="0 0 640 280" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${gradientId}-soil`} x1="290" y1="109" x2="352" y2="252" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a27b51" />
          <stop offset="1" stopColor="#956b43" />
        </linearGradient>
        <linearGradient id={`${gradientId}-leaf`} x1="61" y1="159" x2="130" y2="233" gradientUnits="userSpaceOnUse">
          <stop stopColor="#35cfaa" />
          <stop offset="1" stopColor="#06ae86" />
        </linearGradient>
      </defs>
      <ellipse cx="320" cy="243" rx="305" ry="29" fill="#f3f0e2" opacity=".84" />
      <g opacity={leavesOpacity}>
        <path d="M118 243C111 222 109 207 105 190M119 242C123 221 128 206 137 189" stroke="#06ad86" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M110 228C78 226 59 200 65 174C93 174 113 193 110 228Z" fill={`url(#${gradientId}-leaf)`} />
        <path d="M128 215C119 195 129 176 148 172C154 192 149 207 128 215Z" fill={`url(#${gradientId}-leaf)`} />
        <path d="M527 248C518 228 514 210 507 199M527 248C535 231 544 219 552 207" stroke="#08ae89" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M518 230C493 227 483 209 490 182C513 190 523 209 518 230Z" fill={`url(#${gradientId}-leaf)`} />
        <path d="M533 236C530 214 546 199 567 201C568 222 554 238 533 236Z" fill={`url(#${gradientId}-leaf)`} />
      </g>
      <g opacity={leavesOpacity * 0.72}>
        <path d="M171 117C145 113 129 94 134 64C158 69 172 89 171 117Z" fill="#8ddfc0" />
        <path d="M518 151C514 122 531 100 557 93C562 120 546 145 518 151Z" fill="#8ddfc0" />
      </g>
      <path d="M139 248C137 232 150 219 164 213C167 194 186 182 206 179C219 157 243 147 268 149C287 126 307 115 327 115C349 114 369 129 385 140C411 135 434 155 450 180C474 177 492 196 498 217C514 223 516 235 511 248C468 258 391 263 324 263C258 263 185 260 139 248Z" fill={`url(#${gradientId}-soil)`} />
      <path d="M165 213C178 215 187 219 190 226M266 150C279 153 287 160 291 169M384 141C373 145 367 150 363 158" stroke="#aa8155" strokeWidth="5" strokeLinecap="round" opacity=".33" />
      <g fill="#815a36" opacity=".64">
        <ellipse cx="200" cy="229" rx="7.5" ry="8" transform="rotate(16 200 229)" />
        <ellipse cx="250" cy="184" rx="4.5" ry="5" />
        <ellipse cx="286" cy="225" rx="7.5" ry="8" transform="rotate(-12 286 225)" />
        <ellipse cx="308" cy="177" rx="4" ry="4.5" />
        <ellipse cx="331" cy="154" rx="5" ry="5.5" />
        <ellipse cx="347" cy="239" rx="4.5" ry="5.5" />
        <ellipse cx="405" cy="212" rx="7.5" ry="8.5" transform="rotate(-10 405 212)" />
        <ellipse cx="466" cy="229" rx="5.5" ry="6" />
      </g>
    </svg>
  )
}

// Replace individual entries as the corresponding plant illustrations are designed.
// Keeping the soil fallback intentionally preserves the first version's quiet visual.
const growthStages: Record<ProjectGrowthStage, ComponentType<StageProps>> = {
  seed: SeedStage,
  sprout: SeedStage,
  small: SeedStage,
  medium: SeedStage,
  large: SeedStage,
  'nearly-complete': SeedStage,
  complete: SeedStage,
}

export function ProjectGrowth({ progress }: StageProps) {
  const value = normalizeProjectProgress(progress)
  const stage = getProjectGrowthStage(value)
  const Stage = growthStages[stage]

  return (
    <div className="project-growth" data-growth-stage={stage} role="img" aria-label={`Tierra y hojas: el proyecto tiene un ${Math.round(value)}% de avance de obra.`}>
      <Stage progress={value} />
    </div>
  )
}
