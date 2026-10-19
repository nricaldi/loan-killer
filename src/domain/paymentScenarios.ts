import { daysBetween } from './dates'
import { compareOneTimePayment, oneTimePaymentAvailability, type OneTimePaymentComparison, type PayoffSavings } from './oneTimePayment'
import type { LoanRecord, PortfolioProjection } from './portfolio'
import { projectRecurringPayments, recurringStartDate, strategyNames, validateRepaymentStrategy, type RepaymentStrategy } from './recurringPayments'

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
  strategy?: RepaymentStrategy
}

export interface StrategyProjection {
  strategy: RepaymentStrategy
  label: string
  monthly: PaymentScenario
  combined: PaymentScenario
}

export interface PaymentScenarios {
  request: PaymentScenarioRequest & { strategy: RepaymentStrategy }
  oneTime: OneTimePaymentComparison
  scenarios: PaymentScenario[]
  monthlyBudgetCents: number
  recurringStartDate: string
  strategies: StrategyProjection[]
}

export function comparePaymentScenarios(loans: readonly LoanRecord[], request: PaymentScenarioRequest): PaymentScenarios {
  const strategy = request.strategy ?? 'highest-rate'
  validateRepaymentStrategy(strategy)
  const unavailable = oneTimePaymentAvailability(loans, request.date)
  if (unavailable) throw new Error(unavailable)
  const oneTime = compareOneTimePayment(loans, { loanId: request.loanId, amountCents: request.oneTimeCents, date: request.date })
  const start = recurringStartDate(loans)
  if (!start) throw new Error('Add a loan before comparing payments.')
  const baseline = oneTime.baseline.projection

  function plan(id: ScenarioId, label: string, portfolio: PortfolioProjection): PaymentScenario {
    return {
      id, label, portfolio,
      savings: baseline.status === 'paid-off' && portfolio.projection.status === 'paid-off'
        ? {
            interestCents: baseline.remainingInterestCents - portfolio.projection.remainingInterestCents,
            days: daysBetween(portfolio.projection.payoffDate, baseline.payoffDate),
          }
        : null,
    }
  }

  const strategies: StrategyProjection[] = (['highest-rate', 'smallest-balance'] as const).map((choice) => {
    const monthly = projectRecurringPayments(loans, request.extraMonthlyCents, undefined, choice)
    const combined = projectRecurringPayments(loans, request.extraMonthlyCents, oneTime.payment, choice)
    if (!monthly || !combined) throw new Error('Add a loan before comparing payments.')
    return {
      strategy: choice,
      label: strategyNames[choice],
      monthly: plan('monthly', 'Extra monthly only', monthly),
      combined: plan('combined', 'One-time + monthly', combined),
    }
  })
  const chosen = strategies.find((projection) => projection.strategy === strategy)
  if (!chosen) throw new Error('Missing chosen strategy.')
  return {
    request: { ...request, strategy },
    oneTime,
    monthlyBudgetCents: oneTime.baseline.monthlyPaymentCents + request.extraMonthlyCents,
    recurringStartDate: start,
    strategies,
    scenarios: [plan('minimum', 'Minimum only', oneTime.baseline), plan('one-time', 'One-time only', oneTime.scenario), chosen.monthly, chosen.combined],
  }
}

export function selectPaymentStrategy(result: PaymentScenarios, strategy: RepaymentStrategy): PaymentScenarios {
  validateRepaymentStrategy(strategy)
  const chosen = result.strategies.find((projection) => projection.strategy === strategy)
  if (!chosen) throw new Error('Missing chosen strategy.')
  return {
    ...result,
    request: { ...result.request, strategy },
    scenarios: result.scenarios.map((plan) => plan.id === 'monthly' ? chosen.monthly : plan.id === 'combined' ? chosen.combined : plan),
  }
}
