import { balanceAtDate, type Projection } from './loan'
import { combinePaymentSchedules, type PortfolioProjection } from './portfolio'

// Bound only the chart, never the plan's financial totals or payoff estimate.
export function balanceWindow(portfolio: PortfolioProjection, horizon?: string): {
  projection: Projection
  endPoint?: { date: string; balanceCents: number }
} {
  if (!horizon || (portfolio.projection.status === 'paid-off' && portfolio.projection.payoffDate <= horizon)) {
    return { projection: portfolio.projection }
  }
  const loans = portfolio.loans.map(({ loan, projection }) => ({
    loan, projection: { ...projection, schedule: projection.schedule.filter((payment) => payment.date <= horizon) },
  }))
  const balanceCents = loans.reduce((total, { loan, projection }) => total + balanceAtDate(
    loan, projection.schedule.at(-1) ?? { ...loan, date: loan.balanceDate }, horizon,
  ), 0)
  return {
    projection: {
      status: portfolio.projection.status === 'insufficient-payment' ? 'insufficient-payment' : 'projection-limit',
      schedule: combinePaymentSchedules(loans),
    },
    endPoint: { date: horizon, balanceCents },
  }
}
