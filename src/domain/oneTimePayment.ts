import { daysBetween, parseDate } from './dates'
import {
  projectPortfolio,
  type LoanRecord,
  type PortfolioProjection,
  type ProjectedLoan,
  type TargetedOneTimePayment,
} from './portfolio'

export interface PayoffSavings {
  interestCents: number
  days: number
}

export interface OneTimePaymentComparison {
  baseline: PortfolioProjection
  scenario: PortfolioProjection
  targetBaseline: ProjectedLoan
  targetScenario: ProjectedLoan
  payment: TargetedOneTimePayment
  appliedCents: number
  unusedCents: number
  interestPaidCents: number
  principalPaidCents: number
  balanceAfterExtraCents: number
  savings: PayoffSavings | null
}

export function oneTimePaymentAvailability(loans: readonly LoanRecord[], date: string): string | null {
  const parsedDate = parseDate(date)
  if (!parsedDate || parsedDate.getUTCFullYear() < 1900 || parsedDate.getUTCFullYear() > 2100) {
    return 'Use a valid payment date between 1900 and 2100.'
  }
  if (!loans.length) return 'Add a loan before comparing an extra payment.'
  if (loans.some((loan) => loan.balanceDate > date)) {
    return 'Your balance date is in the future. Use balances dated today or earlier to model a payment today.'
  }
  if (loans.some((loan) => loan.nextPaymentDate < date)) {
    return 'A next payment date is in the past. Update your balances and next payment dates first; we won’t assume earlier payments happened.'
  }
  return null
}

export function compareOneTimePayment(
  loans: readonly LoanRecord[],
  payment: TargetedOneTimePayment,
): OneTimePaymentComparison {
  const unavailable = oneTimePaymentAvailability(loans, payment.date)
  if (unavailable) throw new Error(unavailable)
  const baseline = projectPortfolio(loans)
  const scenario = projectPortfolio(loans, payment)
  if (!baseline || !scenario) throw new Error('Add a loan before comparing an extra payment.')
  const targetBaseline = baseline.loans.find(({ loan }) => loan.id === payment.loanId)
  const targetScenario = scenario.loans.find(({ loan }) => loan.id === payment.loanId)
  if (!targetBaseline || !targetScenario) throw new Error('Choose an existing loan for the extra payment.')
  const applied = targetScenario.projection.schedule.find((row) => row.kind === 'extra')
  const { loan } = targetBaseline
  const balanceToday = loan.principalCents + loan.accruedInterestCents
    + Math.round(loan.principalCents * loan.annualRatePercent / 100 * daysBetween(loan.balanceDate, payment.date) / 365)

  return {
    baseline,
    scenario,
    targetBaseline,
    targetScenario,
    payment: { ...payment },
    appliedCents: applied?.paymentCents ?? 0,
    unusedCents: payment.amountCents - (applied?.paymentCents ?? 0),
    interestPaidCents: applied?.interestPaidCents ?? 0,
    principalPaidCents: applied?.principalPaidCents ?? 0,
    balanceAfterExtraCents: applied?.balanceCents ?? balanceToday,
    savings: baseline.projection.status === 'paid-off' && scenario.projection.status === 'paid-off'
      ? {
          interestCents: baseline.projection.remainingInterestCents - scenario.projection.remainingInterestCents,
          days: daysBetween(scenario.projection.payoffDate, baseline.projection.payoffDate),
        }
      : null,
  }
}
