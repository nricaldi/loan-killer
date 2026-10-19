import { daysBetween } from './dates'
import type { PortfolioProjection } from './portfolio'

export interface MilestoneLoan {
  id: string
  name: string
  originalMinimumCents: number
  baselinePayoffDate: string | null
  daysSaved: number | null
}

export interface PayoffMilestone {
  date: string
  loans: MilestoneLoan[]
  remainingLoans: number
}

export interface PayoffTimeline {
  milestones: PayoffMilestone[]
  unresolved: { id: string; name: string }[]
}

export function buildPayoffTimeline(portfolio: PortfolioProjection, baseline: PortfolioProjection): PayoffTimeline {
  const baselineDates = new Map(baseline.loans.map(({ loan, projection }) => [loan.id, projection.status === 'paid-off' ? projection.payoffDate : null]))
  const grouped = new Map<string, MilestoneLoan[]>()
  const unresolved: PayoffTimeline['unresolved'] = []
  for (const { loan, projection } of portfolio.loans) {
    if (projection.status !== 'paid-off') {
      unresolved.push({ id: loan.id, name: loan.name })
      continue
    }
    const baselinePayoffDate = baselineDates.get(loan.id) ?? null
    const loans = grouped.get(projection.payoffDate) ?? []
    loans.push({
      id: loan.id,
      name: loan.name,
      originalMinimumCents: loan.monthlyPaymentCents,
      baselinePayoffDate,
      daysSaved: baselinePayoffDate ? daysBetween(projection.payoffDate, baselinePayoffDate) : null,
    })
    grouped.set(projection.payoffDate, loans)
  }
  let remainingLoans = portfolio.loans.length
  const milestones = [...grouped].sort(([left], [right]) => left.localeCompare(right)).map(([date, loans]) => {
    remainingLoans -= loans.length
    return { date, loans: [...loans].sort((left, right) => left.id.localeCompare(right.id)), remainingLoans }
  })
  return { milestones, unresolved: unresolved.sort((left, right) => left.id.localeCompare(right.id)) }
}
