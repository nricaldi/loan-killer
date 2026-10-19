import { daysBetween } from './dates'
import { compareOneTimePayment, oneTimePaymentAvailability, type OneTimePaymentComparison, type PayoffSavings } from './oneTimePayment'
import type { LoanRecord, PortfolioProjection } from './portfolio'
import { projectRecurringPayments, recurringStartDate } from './recurringPayments'

export type ScenarioId = 'minimum' | 'one-time' | 'monthly' | 'combined'
export type ExtraScenarioId = Exclude<ScenarioId, 'minimum'>

export interface PaymentScenario {
  id: ScenarioId
  label: string
  portfolio: PortfolioProjection
  savings: PayoffSavings | null
}

export interface PaymentScenarioRequest {
  loanId: string
  oneTimeCents: number
  extraMonthlyCents: number
  date: string
}

export interface PaymentScenarios {
  request: PaymentScenarioRequest
  oneTime: OneTimePaymentComparison
  scenarios: PaymentScenario[]
  monthlyBudgetCents: number
  recurringStartDate: string
}

export function comparePaymentScenarios(loans: readonly LoanRecord[], request: PaymentScenarioRequest): PaymentScenarios {
  const unavailable = oneTimePaymentAvailability(loans, request.date)
  if (unavailable) throw new Error(unavailable)
  const oneTime = compareOneTimePayment(loans, { loanId: request.loanId, amountCents: request.oneTimeCents, date: request.date })
  const monthly = projectRecurringPayments(loans, request.extraMonthlyCents)
  const combined = projectRecurringPayments(loans, request.extraMonthlyCents, oneTime.payment)
  const start = recurringStartDate(loans)
  if (!monthly || !combined || !start) throw new Error('Add a loan before comparing payments.')
  const plans: { id: ScenarioId; label: string; portfolio: PortfolioProjection }[] = [
    { id: 'minimum', label: 'Minimum only', portfolio: oneTime.baseline },
    { id: 'one-time', label: 'One-time only', portfolio: oneTime.scenario },
    { id: 'monthly', label: 'Extra monthly only', portfolio: monthly },
    { id: 'combined', label: 'One-time + monthly', portfolio: combined },
  ]
  const baseline = oneTime.baseline.projection
  return {
    request: { ...request },
    oneTime,
    monthlyBudgetCents: oneTime.baseline.monthlyPaymentCents + request.extraMonthlyCents,
    recurringStartDate: start,
    scenarios: plans.map((plan) => ({
      ...plan,
      savings: baseline.status === 'paid-off' && plan.portfolio.projection.status === 'paid-off'
        ? {
            interestCents: baseline.remainingInterestCents - plan.portfolio.projection.remainingInterestCents,
            days: daysBetween(plan.portfolio.projection.payoffDate, baseline.payoffDate),
          }
        : null,
    })),
  }
}
