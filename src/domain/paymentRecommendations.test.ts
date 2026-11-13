import { describe, expect, it } from 'vitest'
import { compareRecommendedOptions, recommendPayments } from './paymentRecommendations'
import { createRecurringPaymentProjector, projectRecurringPayments } from './recurringPayments'
import { comparePaymentScenarios, createPaymentScenarioComparer } from './paymentScenarios'
import type { LoanRecord } from './portfolio'

const large: LoanRecord = {
  id: 'a', name: 'Large loan', fromExample: false, type: 'unsubsidized', principalCents: 100000,
  accruedInterestCents: 0, annualRatePercent: 12, monthlyPaymentCents: 10000,
  balanceDate: '2025-01-01', nextPaymentDate: '2025-02-01',
}
const small: LoanRecord = { ...large, id: 'b', name: 'Small loan', principalCents: 20000, annualRatePercent: 3, monthlyPaymentCents: 5000, nextPaymentDate: '2025-02-15' }
const date = large.balanceDate

describe('automatic payment recommendations', () => {
  it('checks every one-time target and recommends actual interest savings over nominal rates', () => {
    const loans = [
      { ...large, principalCents: 0, accruedInterestCents: 100000, annualRatePercent: 100, monthlyPaymentCents: 1000 },
      { ...small, principalCents: 10000, annualRatePercent: 12, monthlyPaymentCents: 1000 },
    ]
    const recommendation = recommendPayments(loans, { oneTimeCents: 5000, extraMonthlyCents: 0, date }).plans['one-time']!
    expect(recommendation.alternatives).toHaveLength(2)
    expect(recommendation.option.loanId).toBe('b')
    expect(recommendation.option.interestCents).toBeLessThan(recommendation.alternatives[1]!.interestCents!)
    expect(recommendation.result.request.loanId).toBe('b')
  })

  it('chooses the cheaper monthly method, including when smallest-balance-first beats highest-rate-first', () => {
    const recommendation = recommendPayments([
      { ...large, principalCents: 0, accruedInterestCents: 100000, annualRatePercent: 100, monthlyPaymentCents: 1000 },
      { ...small, principalCents: 10000, annualRatePercent: 12, monthlyPaymentCents: 1000 },
    ], { oneTimeCents: 0, extraMonthlyCents: 5000, date }).plans.monthly!
    expect(recommendation.option.strategy).toBe('smallest-balance')
    expect(recommendation.alternatives).toHaveLength(2)
    expect(recommendation.firstMonthlyPayments[0]?.loanId).toBe('b')
    expect(recommendation.result.request.strategy).toBe('smallest-balance')
  })

  it('compares all target/method pairs for combined payments and retains separate winners for each plan', () => {
    const input = Object.freeze([Object.freeze(large), Object.freeze(small)])
    const { plans } = recommendPayments(input, { oneTimeCents: 15000, extraMonthlyCents: 5000, date })
    expect(plans['one-time']!.alternatives).toHaveLength(2)
    expect(plans.monthly!.alternatives).toHaveLength(2)
    expect(plans.combined!.alternatives).toHaveLength(4)
    for (const id of ['one-time', 'monthly', 'combined'] as const) {
      const recommendation = plans[id]!
      expect(recommendation.option.interestCents).toBe(Math.min(...recommendation.alternatives.map((option) => option.interestCents!)))
      const projection = recommendation.result.scenarios.find((plan) => plan.id === id)!.portfolio.projection
      expect(projection.status).toBe('paid-off')
      if (projection.status === 'paid-off') expect(projection.remainingInterestCents).toBe(recommendation.option.interestCents)
    }
    expect(input[0]!.principalCents).toBe(100000)
  })

  it('breaks an interest tie by the overall payoff date, then stable IDs independent of display order', () => {
    const loans = [{ ...large, annualRatePercent: 0 }, { ...small, annualRatePercent: 0 }]
    const request = { oneTimeCents: 50000, extraMonthlyCents: 0, date }
    const first = recommendPayments(loans, request).plans['one-time']!
    expect(first.option.loanId).toBe('a')
    expect(first.option.interestCents).toBe(0)
    expect(first.option.payoffDate! < first.alternatives[1]!.payoffDate!).toBe(true)
    expect(recommendPayments([...loans].reverse(), request).plans['one-time']!.option).toEqual(first.option)
    const tied = recommendPayments([{ ...loans[0]!, principalCents: 10000 }, { ...loans[0]!, id: 'z', principalCents: 10000 }], { oneTimeCents: 1, extraMonthlyCents: 0, date }).plans['one-time']!
    expect(tied.tied).toBe(true)
    expect(tied.option.loanId).toBe('a')
  })

  it('prefers a complete estimate over an unavailable lifetime cost', () => {
    const { plans } = recommendPayments([
      { ...large, monthlyPaymentCents: 1 }, { ...small, annualRatePercent: 0 },
    ], { oneTimeCents: 200000, extraMonthlyCents: 0, date })
    expect(plans['one-time']!.option.loanId).toBe('a')
    expect(plans['one-time']!.option.payoffDate).not.toBeNull()
    expect(plans['one-time']!.alternatives[1]!.interestCents).toBeNull()
  })

  it('does not invent cost or time rankings when every option is incomplete', () => {
    const { plans } = recommendPayments([
      { ...large, principalCents: 1000000000, annualRatePercent: 100, monthlyPaymentCents: 1 }, small,
    ], { oneTimeCents: 1, extraMonthlyCents: 1, date })
    for (const recommendation of Object.values(plans)) {
      expect(recommendation.option.interestCents).toBeNull()
      expect(recommendation.option.payoffDate).toBeNull()
      expect(recommendation.fastestAlternative).toBeNull()
      expect(recommendation.tied).toBe(false)
    }
  })

  it('preserves unused lump sums and uses actual first allocations when an extra pool spans loans', () => {
    const paid = recommendPayments([small], { oneTimeCents: 50000, extraMonthlyCents: 5000, date }).plans.combined!
    expect(paid.result.oneTime.unusedCents).toBe(30000)
    expect(paid.firstMonthlyPayments).toHaveLength(0)
    const split = recommendPayments([{ ...large, annualRatePercent: 0 }, { ...small, annualRatePercent: 0 }], { oneTimeCents: 0, extraMonthlyCents: 200000, date }).plans.monthly!
    expect(split.firstMonthlyPayments).toHaveLength(2)
    expect(split.firstMonthlyPayments.reduce((sum, payment) => sum + payment.amountCents, 0)).toBe(110000)
  })

  it('reports a faster alternative separately when it costs more interest', () => {
    const recommendation = recommendPayments([
      { ...large, annualRatePercent: 24, monthlyPaymentCents: 20000 },
      { ...small, principalCents: 100000, annualRatePercent: 1, monthlyPaymentCents: 1000 },
    ], { oneTimeCents: 10000, extraMonthlyCents: 0, date }).plans['one-time']!
    expect(recommendation.option).toMatchObject({ loanId: 'a', interestCents: 9720, payoffDate: '2033-10-15' })
    expect(recommendation.fastestAlternative).toMatchObject({ loanId: 'b', interestCents: 10005, payoffDate: '2032-11-15' })
  })

  it('orders cost before time without hiding a potentially earlier finish', () => {
    const cheaper = { loanId: 'a', loanName: 'A', strategy: 'highest-rate' as const, interestCents: 100, payoffDate: '2025-05-01' }
    const faster = { ...cheaper, loanId: 'b', interestCents: 200, payoffDate: '2025-04-01' }
    expect(compareRecommendedOptions(cheaper, faster)).toBeLessThan(0)
    expect(compareRecommendedOptions({ ...cheaper, interestCents: 200 }, faster)).toBeGreaterThan(0)
  })
})


describe('reused recommendation calendars', () => {
  it('matches fresh projections across targets and methods without leaking an earlier payment', () => {
    const loans = [large, small]
    const project = createRecurringPaymentProjector(loans, 5000)
    for (const strategy of ['highest-rate', 'smallest-balance'] as const) {
      for (const loanId of ['a', 'b']) {
        const payment = { loanId, date: '2025-01-15', amountCents: 10000 }
        expect(project(payment, strategy)).toEqual(projectRecurringPayments(loans, 5000, payment, strategy))
      }
      expect(project(undefined, strategy)).toEqual(projectRecurringPayments(loans, 5000, undefined, strategy))
    }
  })

  it('captures fixed loan figures, date, and monthly budget for every target comparison', () => {
    const loans = [{ ...large }, { ...small }]
    const shared = { date, extraMonthlyCents: 5000 }
    const compare = createPaymentScenarioComparer(loans, shared)
    const first = compare({ loanId: 'a', oneTimeCents: 10000 })
    loans[0]!.monthlyPaymentCents = 50000
    shared.extraMonthlyCents = 20000
    shared.date = '2025-01-20'
    const second = compare({ loanId: 'b', oneTimeCents: 20000, strategy: 'smallest-balance' })
    expect(first).toEqual(comparePaymentScenarios([large, small], { date, extraMonthlyCents: 5000, loanId: 'a', oneTimeCents: 10000 }))
    expect(second).toEqual(comparePaymentScenarios([large, small], { date, extraMonthlyCents: 5000, loanId: 'b', oneTimeCents: 20000, strategy: 'smallest-balance' }))
  })
})
