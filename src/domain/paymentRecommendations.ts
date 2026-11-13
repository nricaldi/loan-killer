import { createPaymentScenarioComparer, selectPaymentStrategy, type ExtraScenarioId, type PaymentScenarios } from './paymentScenarios'
import type { LoanRecord } from './portfolio'
import type { RepaymentStrategy } from './recurringPayments'

export interface RecommendedOption {
  loanId: string
  loanName: string
  strategy: RepaymentStrategy
  interestCents: number | null
  payoffDate: string | null
}
export interface PaymentRecommendation {
  result: PaymentScenarios
  option: RecommendedOption
  alternatives: RecommendedOption[]
  fastestAlternative: RecommendedOption | null
  tied: boolean
  firstMonthlyPayments: { loanId: string; loanName: string; amountCents: number }[]
}
export interface PaymentRecommendations {
  plans: Partial<Record<ExtraScenarioId, PaymentRecommendation>>
}
interface RankedPlan { option: RecommendedOption; result: PaymentScenarios }

// Complete estimates outrank incomplete ones. Minimize lifetime interest first,
// then the overall payoff date. Stable IDs/order make exact ties reproducible.
export function compareRecommendedOptions(left: RecommendedOption, right: RecommendedOption): number {
  if (left.interestCents !== null && right.interestCents === null) return -1
  if (left.interestCents === null && right.interestCents !== null) return 1
  return (left.interestCents !== null && right.interestCents !== null
    ? left.interestCents - right.interestCents || (left.payoffDate ?? '').localeCompare(right.payoffDate ?? '') : 0)
    || left.loanId.localeCompare(right.loanId)
    || (left.strategy === right.strategy ? 0 : left.strategy === 'highest-rate' ? -1 : 1)
}

export function recommendPayments(
  loans: readonly LoanRecord[],
  request: { oneTimeCents: number; extraMonthlyCents: number; date: string },
): PaymentRecommendations {
  if (!loans.length) throw new Error('Add a loan before comparing payments.')
  // Keep only winning schedules; comparison rows need amounts/dates, not copies
  // of every target's full payment history.
  const buckets = new Map<ExtraScenarioId, { best: RankedPlan; alternatives: RecommendedOption[] }>()
  function collect(result: PaymentScenarios, id: ExtraScenarioId) {
    const projection = result.scenarios.find((plan) => plan.id === id)!.portfolio.projection
    const option: RecommendedOption = {
      loanId: result.request.loanId, loanName: result.oneTime.targetBaseline.loan.name,
      strategy: result.request.strategy,
      interestCents: projection.status === 'paid-off' ? projection.remainingInterestCents : null,
      payoffDate: projection.status === 'paid-off' ? projection.payoffDate : null,
    }
    const bucket = buckets.get(id)
    if (!bucket) buckets.set(id, { best: { option, result }, alternatives: [option] })
    else {
      bucket.alternatives.push(option)
      if (compareRecommendedOptions(option, bucket.best.option) < 0) bucket.best = { option, result }
    }
  }
  const compare = createPaymentScenarioComparer(loans, request)
  const targets = [...loans].sort((left, right) => left.id.localeCompare(right.id))
  for (const [index, loan] of targets.entries()) {
    // A monthly-only allocation has no lump-sum target to vary.
    if (request.oneTimeCents === 0 && index > 0) break
    const result = compare({ oneTimeCents: request.oneTimeCents, loanId: loan.id })
    if (request.oneTimeCents > 0) collect(result, 'one-time')
    if (request.extraMonthlyCents > 0) {
      const strategies: RepaymentStrategy[] = loans.length === 1 ? ['highest-rate'] : ['highest-rate', 'smallest-balance']
      for (const strategy of strategies) {
        const chosen = selectPaymentStrategy(result, strategy)
        if (index === 0) collect(chosen, 'monthly')
        if (request.oneTimeCents > 0) collect(chosen, 'combined')
      }
    }
  }
  const plans: PaymentRecommendations['plans'] = {}
  for (const [id, { best, alternatives }] of buckets) {
    alternatives.sort(compareRecommendedOptions)
    const complete = alternatives.filter((option) => option.payoffDate !== null)
    const fastest = [...complete].sort((left, right) => left.payoffDate!.localeCompare(right.payoffDate!) || compareRecommendedOptions(left, right))[0]
    const portfolio = best.result.scenarios.find((plan) => plan.id === id)!.portfolio
    plans[id] = {
      result: best.result, option: best.option, alternatives,
      fastestAlternative: fastest && best.option.payoffDate && fastest.payoffDate! < best.option.payoffDate ? fastest : null,
      tied: complete.filter((option) => option.interestCents === best.option.interestCents && option.payoffDate === best.option.payoffDate).length > 1,
      firstMonthlyPayments: id === 'one-time' ? [] : portfolio.loans.flatMap(({ loan, projection }) => {
        const amountCents = projection.schedule.filter((payment) => payment.kind === 'monthly-extra' && payment.date === best.result.recurringStartDate)
          .reduce((sum, payment) => sum + payment.paymentCents, 0)
        return amountCents > 0 ? [{ loanId: loan.id, loanName: loan.name, amountCents }] : []
      }),
    }
  }
  return { plans }
}
