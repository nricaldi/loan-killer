import { describe, expect, it } from 'vitest'
import { comparePaymentScenarios, selectPaymentStrategy } from './paymentScenarios'
import { buildPayoffTimeline } from './payoffMilestones'
import type { LoanRecord } from './portfolio'
import { projectRecurringPayments, validateRepaymentStrategy, type RepaymentStrategy } from './recurringPayments'

const large: LoanRecord = {
  id: 'loan-a', fromExample: false, name: 'Larger, higher-rate loan', type: 'unsubsidized',
  principalCents: 100_000, accruedInterestCents: 0, annualRatePercent: 12, monthlyPaymentCents: 10_000,
  balanceDate: '2025-01-01', nextPaymentDate: '2025-02-01',
}
const small: LoanRecord = {
  ...large, id: 'loan-b', name: 'Smaller loan', principalCents: 20_000, annualRatePercent: 3,
  monthlyPaymentCents: 5_000, nextPaymentDate: '2025-02-15',
}
const request = { loanId: large.id, date: large.balanceDate, oneTimeCents: 0, extraMonthlyCents: 5_000 }

describe('repayment strategies', () => {
  it('defaults to the existing highest-rate behavior', () => {
    expect(projectRecurringPayments([large, small], 5_000)).toEqual(projectRecurringPayments([large, small], 5_000, undefined, 'highest-rate'))
  })

  it('targets the smallest total balance instead of the highest rate', () => {
    const highest = projectRecurringPayments([large, small], 5_000, undefined, 'highest-rate')
    const smallest = projectRecurringPayments([large, small], 5_000, undefined, 'smallest-balance')
    expect(highest?.loans[0]?.projection.schedule.find(({ kind }) => kind === 'monthly-extra')).toMatchObject({ date: '2025-02-01', paymentCents: 5_000 })
    expect(smallest?.loans[1]?.projection.schedule[0]).toMatchObject({ kind: 'monthly-extra', date: '2025-02-01', paymentCents: 5_000 })
    expect(smallest?.loans[0]?.projection.schedule[0]).toMatchObject({ kind: 'scheduled', date: large.nextPaymentDate, paymentCents: large.monthlyPaymentCents })
    expect(smallest?.loans[1]?.projection.schedule.find(({ kind }) => kind === 'scheduled')).toMatchObject({ date: small.nextPaymentDate, paymentCents: small.monthlyPaymentCents })
  })

  it('uses balances after every due minimum, not the initial loan sizes', () => {
    const first = { ...large, id: 'loan-z', principalCents: 50_000, annualRatePercent: 0, monthlyPaymentCents: 40_000 }
    const second = { ...small, id: 'loan-a', principalCents: 49_000, annualRatePercent: 0, monthlyPaymentCents: 1_000, nextPaymentDate: first.nextPaymentDate }
    const result = projectRecurringPayments([first, second], 1_000, undefined, 'smallest-balance')
    expect(result?.loans[0]?.projection.schedule[1]).toMatchObject({ kind: 'monthly-extra', date: first.nextPaymentDate, paymentCents: 1_000 })
    expect(result?.loans[1]?.projection.schedule.some(({ kind, date }) => kind === 'monthly-extra' && date === first.nextPaymentDate)).toBe(false)
  })

  it('counts unpaid interest rather than comparing principal alone', () => {
    const first = { ...large, principalCents: 10_000, accruedInterestCents: 100_000, monthlyPaymentCents: 1_000 }
    const result = projectRecurringPayments([first, { ...small, nextPaymentDate: first.nextPaymentDate }], 1_000, undefined, 'smallest-balance')
    expect(result?.loans[1]?.projection.schedule[1]?.kind).toBe('monthly-extra')
    expect(result?.loans[0]?.projection.schedule[1]?.date).not.toBe(first.nextPaymentDate)
  })

  it('re-evaluates priorities as separate minimum-payment dates change balances', () => {
    const first = { ...large, annualRatePercent: 0, monthlyPaymentCents: 80_000, nextPaymentDate: '2025-02-15' }
    const second = { ...small, principalCents: 50_000, annualRatePercent: 0, monthlyPaymentCents: 1_000, nextPaymentDate: '2025-02-01' }
    const result = projectRecurringPayments([first, second], 10_000, undefined, 'smallest-balance')
    expect(result?.loans[1]?.projection.schedule.find(({ kind }) => kind === 'monthly-extra')?.date).toBe('2025-02-01')
    expect(result?.loans[0]?.projection.schedule.find(({ kind }) => kind === 'monthly-extra')?.date).toBe('2025-03-01')
  })

  it('re-evaluates the smallest loan after the fixed-target lump sum is applied', () => {
    const result = projectRecurringPayments([large, small], 1_000, {
      loanId: large.id, date: large.balanceDate, amountCents: 85_000,
    }, 'smallest-balance')
    expect(result?.loans[0]?.projection.schedule.find(({ kind }) => kind === 'monthly-extra')?.date).toBe('2025-02-01')
    expect(result?.loans[0]?.projection.schedule[0]).toMatchObject({ kind: 'extra', paymentCents: 85_000 })
  })

  it('measures the interest-versus-first-payoff tradeoff with the same budget', () => {
    const result = comparePaymentScenarios([large, small], request)
    const highest = result.strategies[0]?.monthly.portfolio
    const smallest = result.strategies[1]?.monthly.portfolio
    expect(result.monthlyBudgetCents).toBe(20_000)
    expect(highest?.projection).toMatchObject({ payoffDate: '2025-08-01', remainingInterestCents: 4_017, totalPaymentsCents: 124_017 })
    expect(smallest?.projection).toMatchObject({ payoffDate: '2025-08-01', remainingInterestCents: 4_212, totalPaymentsCents: 124_212 })
    if (!highest || !smallest) throw new Error('Expected strategy projections')
    expect(buildPayoffTimeline(highest, result.oneTime.baseline).milestones[0]?.date).toBe('2025-06-15')
    expect(buildPayoffTimeline(smallest, result.oneTime.baseline).milestones[0]?.date).toBe('2025-04-01')
  })

  it('reconciles all principal, interest, lump sums and rollovers under both strategies', () => {
    for (const strategy of ['highest-rate', 'smallest-balance'] as const) {
      const result = projectRecurringPayments([large, small], 5_000, {
        loanId: large.id, date: '2025-01-15', amountCents: 10_000,
      }, strategy)
      if (!result || result.projection.status !== 'paid-off') throw new Error('Expected payoff')
      const projection = result.projection
      expect(projection.totalPaymentsCents).toBe(result.principalCents + projection.remainingInterestCents)
      expect(projection.schedule.reduce((sum, row) => sum + row.paymentCents, 0)).toBe(projection.totalPaymentsCents)
      expect(projection.schedule.reduce((sum, row) => sum + row.interestPaidCents, 0)).toBe(projection.remainingInterestCents)
      expect(projection.schedule.reduce((sum, row) => sum + row.principalPaidCents, 0)).toBe(result.principalCents)
      expect(projection.schedule.reduce((sum, row) => sum + row.newInterestCents, 0)).toBe(projection.futureInterestCents)
      expect(projection.schedule.at(-1)?.balanceCents).toBe(0)
    }
  })

  it('does not force an avalanche cost winner for loans with non-capitalized unpaid interest', () => {
    const interestOnly = { ...large, principalCents: 0, accruedInterestCents: 100_000, annualRatePercent: 100, monthlyPaymentCents: 1_000 }
    const principalLoan = { ...small, principalCents: 10_000, annualRatePercent: 12, monthlyPaymentCents: 1_000 }
    const result = comparePaymentScenarios([interestOnly, principalLoan], request)
    const highest = result.strategies[0]?.monthly.portfolio.projection
    const smallest = result.strategies[1]?.monthly.portfolio.projection
    if (highest?.status !== 'paid-off' || smallest?.status !== 'paid-off') throw new Error('Expected payoff')
    expect(smallest.remainingInterestCents).toBeLessThan(highest.remainingInterestCents)
  })

  it('keeps zero-extra scenarios identical without enabling strategy-dependent rollover', () => {
    const result = comparePaymentScenarios([large, small], { ...request, extraMonthlyCents: 0, oneTimeCents: 10_000, strategy: 'smallest-balance' })
    for (const strategy of result.strategies) {
      expect(strategy.monthly.portfolio).toEqual(result.oneTime.baseline)
      expect(strategy.combined.portfolio).toEqual(result.oneTime.scenario)
    }
  })

  it('uses stable IDs to break equal-balance ties and does not mutate or reorder input loans', () => {
    const first = Object.freeze({ ...large, principalCents: 20_000, annualRatePercent: 0, monthlyPaymentCents: 1_000 })
    const second = Object.freeze({ ...first, id: 'loan-b', name: first.name })
    const records = [first, second]
    const before = structuredClone(records)
    const result = projectRecurringPayments(records, 500, undefined, 'smallest-balance')
    expect(result?.loans[0]?.projection.schedule[1]?.kind).toBe('monthly-extra')
    expect(result?.projection).toEqual(projectRecurringPayments([...records].reverse(), 500, undefined, 'smallest-balance')?.projection)
    expect(records).toEqual(before)
  })

  it('switches cached strategies without changing requests, minimum-only or one-time-only projections', () => {
    const result = comparePaymentScenarios([large, small], { ...request, oneTimeCents: 10_000 })
    const before = structuredClone(result)
    const switched = selectPaymentStrategy(result, 'smallest-balance')
    expect(result).toEqual(before)
    expect(switched.request.strategy).toBe('smallest-balance')
    expect(switched.scenarios[0]).toBe(result.scenarios[0])
    expect(switched.scenarios[1]).toBe(result.scenarios[1])
    expect(switched.scenarios[2]).toBe(result.strategies[1]?.monthly)
    expect(switched.scenarios[3]).toBe(result.strategies[1]?.combined)
    expect(selectPaymentStrategy(switched, 'highest-rate')).toEqual(result)
  })

  it('withholds lifetime savings when a strategy cannot pay off', () => {
    const result = comparePaymentScenarios([{ ...large, annualRatePercent: 100, monthlyPaymentCents: 1 }, small], { ...request, extraMonthlyCents: 1 })
    for (const strategy of result.strategies) {
      expect(strategy.monthly.portfolio.projection.status).not.toBe('paid-off')
      expect(strategy.monthly.savings).toBeNull()
      expect(strategy.monthly.portfolio.projection).not.toHaveProperty('totalPaymentsCents')
    }
  })

  it('rejects an unsupported strategy even when extra monthly is zero', () => {
    expect(() => validateRepaymentStrategy('unknown')).toThrow('Choose highest rate')
    expect(() => projectRecurringPayments([large], 0, undefined, 'unknown' as RepaymentStrategy)).toThrow()
    expect(() => comparePaymentScenarios([large], { ...request, strategy: 'unknown' as RepaymentStrategy })).toThrow()
  })
})
