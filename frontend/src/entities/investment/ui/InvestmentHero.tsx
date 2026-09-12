import type { InvestmentDetail } from '../model/investment.types'
import { CompanyLogo } from './CompanyLogo'
import { ProjectPlantGrowth } from './ProjectPlantGrowth'

export function InvestmentHero({ company, progress }: { company: InvestmentDetail['company']; progress: number }) {
  return (
    <div className="investment-hero">
      <CompanyLogo company={company} />
      <ProjectPlantGrowth progress={progress} />
    </div>
  )
}
