import { describe, expect, it } from 'vitest'
import { goalMonthEnd, monthlyExtraForGoal, payoffGoalSearch } from './payoffGoal'
import { recommendPayments } from './paymentRecommendations'
import type { LoanRecord } from './portfolio'

const loan: LoanRecord = {
  id: 'a', name: 'Loan A', type: 'unsubsidized', fromExample: false,
  principalCents: 100000, accruedInterestCents: 2500, annualRatePercent: 6,
  monthlyPaymentCents: 1000, balanceDate: '2025-01-01', nextPaymentDate: '2025-02-01',
}
const date = loan.balanceDate

describe('linked payoff-month goals', () => {
  it('finds a verified cent-accurate extra while holding a lump sum fixed', () => {
    const saved = structuredClone(loan)
    const result = monthlyExtraForGoal([loan], { date, goalMonth: '2026-01', oneTimeCents: 10000 })!
    expect(Number.isSafeInteger(result.extraMonthlyCents)).toBe(true)
    expect(result.extraMonthlyCents).toBeGreaterThan(0)
    expect(result.payoffDate <= '2026-01-31').toBe(true)
    const smaller = recommendPayments([loan], { date, extraMonthlyCents: result.extraMonthlyCents - 1, oneTimeCents: 10000, payoffBy: '2026-01-31', rollFreedMinimums: false }).plans.combined!
    expect(smaller.option.payoffDate === null || smaller.option.payoffDate > '2026-01-31').toBe(true)
    expect(loan).toEqual(saved)
  })

  it('solves multiple loans including an unpaid baseline and staggered dates', () => {
    const loans = [loan, { ...loan, id: 'b', annualRatePercent: 12, principalCents: 50000, monthlyPaymentCents: 0, nextPaymentDate: '2025-02-20' }]
    const result = monthlyExtraForGoal(loans, { date, goalMonth: '2027-02', oneTimeCents: 5000 })!
    const plan = recommendPayments(loans, { date, oneTimeCents: 5000, extraMonthlyCents: result.extraMonthlyCents, payoffBy: '2027-02-28', rollFreedMinimums: false }).plans.combined!
    expect(plan.option.payoffDate! <= '2027-02-28').toBe(true)
    expect(result.payoffDate).toBe(plan.option.payoffDate)
  })

  it('needs no extra if minimums already meet the goal or the lump sum clears the loan', () => {
    expect(monthlyExtraForGoal([{ ...loan, annualRatePercent: 0, monthlyPaymentCents: 100000 }], { date, goalMonth: '2026-01', oneTimeCents: 0 })?.extraMonthlyCents).toBe(0)
    expect(monthlyExtraForGoal([loan], { date, goalMonth: '2025-01', oneTimeCents: 102500 })?.extraMonthlyCents).toBe(0)
  })

  it('does not fake an early payoff before scheduled payments can begin', () => {
    expect(monthlyExtraForGoal([{ ...loan, nextPaymentDate: '2028-01-01' }], { date, goalMonth: '2025-02', oneTimeCents: 0 })).toBeNull()
    expect(monthlyExtraForGoal([loan], { date, goalMonth: '2024-12', oneTimeCents: 0 })).toBeNull()
    expect(monthlyExtraForGoal([], { date, goalMonth: '2026-01', oneTimeCents: 0 })).toBeNull()
  })

  it('uses actual month ends and rejects unknown payment history', () => {
    expect(goalMonthEnd('2028-02')).toBe('2028-02-29')
    expect(goalMonthEnd('2025-02')).toBe('2025-02-28')
    expect(() => goalMonthEnd('2025-13')).toThrow()
    expect(() => monthlyExtraForGoal([loan], { date: '2025-04-01', goalMonth: '2026-01', oneTimeCents: 0 })).toThrow('Update')
  })
  it('reaches dates between the screenshot baseline and the old full-rollover result', () => {
    const records = [
      { ...loan, principalCents: 754100, accruedInterestCents: 7400, annualRatePercent: 6.3, monthlyPaymentCents: 5000, balanceDate: '2026-11-11', nextPaymentDate: '2026-12-11' },
      { ...loan, id: 'b', principalCents: 259800, accruedInterestCents: 0, annualRatePercent: 4.5, monthlyPaymentCents: 6000, balanceDate: '2026-11-11', nextPaymentDate: '2026-12-11' },
    ]
    for (const goalMonth of ['2051-01', '2045-06', '2040-03', '2030-10']) {
      const request = { date: '2026-11-15', oneTimeCents: 0, goalMonth }
      const result = monthlyExtraForGoal(records, request)!
      expect(result.payoffDate.slice(0, 7)).toBe(goalMonth)
      const plan = recommendPayments(records, { date: request.date, oneTimeCents: 0, extraMonthlyCents: result.extraMonthlyCents, rollFreedMinimums: false, payoffBy: goalMonthEnd(goalMonth) }).plans.monthly!
      expect(plan.option.payoffDate).toBe(result.payoffDate)
    }
  })

  it('solves the current month by paying every loan today, with accrued interest and no monthly extra', () => {
    const records = [loan, { ...loan, id: 'b', principalCents: 50000, annualRatePercent: 12, nextPaymentDate: '2025-02-20' }]
    const saved = structuredClone(records)
    const result = monthlyExtraForGoal(records, { date: '2025-01-15', goalMonth: '2025-01', oneTimeCents: 0 })!
    expect(result.extraMonthlyCents).toBe(0)
    expect(result.payoffDate).toBe('2025-01-15')
    expect(result.oneTimeCents).toBe(155460)
    expect(monthlyExtraForGoal(records, { date: '2025-01-15', goalMonth: '2027-01', oneTimeCents: result.oneTimeCents! })?.oneTimeCents).toBe(result.oneTimeCents)
    expect(records).toEqual(saved)
  })

  it('uses a nearby payment to reduce search evaluations without changing the cent-accurate answer', () => {
    const records = [
      { ...loan, principalCents: 754100, accruedInterestCents: 7400, annualRatePercent: 6.3, monthlyPaymentCents: 5000, balanceDate: '2026-11-11', nextPaymentDate: '2026-12-11' },
      { ...loan, id: 'b', principalCents: 259800, accruedInterestCents: 0, annualRatePercent: 4.5, monthlyPaymentCents: 6000, balanceDate: '2026-11-11', nextPaymentDate: '2026-12-11' },
    ]
    const request = { date: '2026-11-15', oneTimeCents: 0, goalMonth: '2051-01' }
    const hint = monthlyExtraForGoal(records, request)!.extraMonthlyCents
    for (const goalMonth of ['2050-12', '2051-02']) {
      function search(extraMonthlyHintCents?: number) {
        const generator = payoffGoalSearch(records, { ...request, goalMonth, extraMonthlyHintCents })
        let evaluations = 0
        let step = generator.next()
        while (!step.done) { evaluations++; step = generator.next() }
        return { result: step.value, evaluations }
      }
      const cold = search()
      const warm = search(hint)
      expect(warm.result).toEqual(cold.result)
      expect(warm.evaluations).toBeLessThan(cold.evaluations)
      expect(search(Number.NaN).result).toEqual(cold.result)
    }
  })

})
