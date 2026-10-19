import { describe, expect, it } from 'vitest'
import { projectPortfolio, type LoanRecord } from './portfolio'
import { projectLoan } from './loan'
import { comparePaymentScenarios } from './paymentScenarios'
import { projectRecurringPayments, recurringStartDate } from './recurringPayments'

const loan: LoanRecord = {
  id: 'loan-a',
  fromExample: false,
  name: 'Loan A',
  type: 'unsubsidized',
  principalCents: 100_000,
  accruedInterestCents: 0,
  annualRatePercent: 0,
  monthlyPaymentCents: 10_000,
  balanceDate: '2025-01-01',
  nextPaymentDate: '2025-02-01',
}
const other: LoanRecord = {
  ...loan,
  id: 'loan-b',
  name: 'Loan B',
  principalCents: 50_000,
  nextPaymentDate: '2025-02-15',
}

describe('extra monthly budget', () => {
  it('starts at the earliest next due date, not the snapshot or today', () => {
    expect(recurringStartDate([other, loan])).toBe('2025-02-01')
    const result = projectRecurringPayments([loan], 10_000)
    expect(result?.loans[0]?.projection.schedule.slice(0, 2)).toMatchObject([
      { date: '2025-02-01', kind: 'scheduled', paymentCents: 10_000 },
      { date: '2025-02-01', kind: 'monthly-extra', paymentCents: 10_000 },
    ])
    expect(result?.projection).toMatchObject({ payoffDate: '2025-06-01', totalPaymentsCents: 100_000 })
  })

  it('applies one extra budget per month across the plan, not per loan', () => {
    const result = projectRecurringPayments([loan, other], 10_000)
    expect(result?.projection).toMatchObject({ payoffDate: '2025-06-15', totalPaymentsCents: 150_000 })
    const firstMonth = result?.projection.schedule.filter(({ date }) => date.startsWith('2025-02')) ?? []
    expect(firstMonth.reduce((sum, payment) => sum + payment.paymentCents, 0)).toBe(30_000)
    expect(result?.loans[0]?.projection.schedule.some(({ kind, date }) => kind === 'monthly-extra' && date === '2025-02-15')).toBe(false)
  })

  it('pays every minimum on its own due date and targets the highest rate for the extra', () => {
    const result = projectRecurringPayments([loan, { ...other, annualRatePercent: 12 }], 10_000)
    expect(result?.loans[0]?.projection.schedule[0]).toMatchObject({ kind: 'scheduled', date: '2025-02-01', paymentCents: 10_000 })
    expect(result?.loans[1]?.projection.schedule.slice(0, 2)).toMatchObject([
      { kind: 'monthly-extra', date: '2025-02-01', paymentCents: 10_000, newInterestCents: 510 },
      { kind: 'scheduled', date: '2025-02-15', paymentCents: 10_000, newInterestCents: 186 },
    ])
  })

  it('matches a single loan’s larger fixed payment without changing its entered minimum', () => {
    const input = { ...loan, annualRatePercent: 5.5, accruedInterestCents: 750 }
    const recurring = projectRecurringPayments([input], 5_000)?.projection
    const largerFixed = projectLoan({ ...input, monthlyPaymentCents: 15_000 })
    if (!recurring || recurring.status !== 'paid-off' || largerFixed.status !== 'paid-off') throw new Error('Expected payoff')
    expect(recurring.payoffDate).toBe(largerFixed.payoffDate)
    expect(recurring.futureInterestCents).toBe(largerFixed.futureInterestCents)
    expect(recurring.totalPaymentsCents).toBe(largerFixed.totalPaymentsCents)
    expect(input.monthlyPaymentCents).toBe(10_000)
  })

  it('rolls the unused part of a final minimum into the next active loan on the same day', () => {
    const result = projectRecurringPayments([{ ...loan, principalCents: 5_000, annualRatePercent: 12 }, { ...other, principalCents: 100_000 }], 1_000)
    expect(result?.loans[0]?.projection.schedule[0]?.paymentCents).toBe(5_051)
    expect(result?.loans[1]?.projection.schedule[0]).toMatchObject({ kind: 'monthly-extra', date: '2025-02-01', paymentCents: 5_949 })
    expect(result?.loans[1]?.projection.schedule.find(({ date }) => date === '2025-03-01')?.paymentCents).toBe(11_000)
  })

  it('does not spill unused one-time money, but rolls the paid-off loan’s minimum on its due date', () => {
    const result = projectRecurringPayments([{ ...loan, principalCents: 5_000 }, { ...other, principalCents: 100_000 }], 1_000, {
      loanId: loan.id, date: loan.balanceDate, amountCents: 100_000,
    })
    expect(result?.loans[0]?.projection.schedule).toHaveLength(1)
    expect(result?.loans[0]?.projection.schedule[0]).toMatchObject({ kind: 'extra', paymentCents: 5_000 })
    expect(result?.loans[1]?.projection.schedule[0]).toMatchObject({ date: '2025-02-01', kind: 'monthly-extra', paymentCents: 11_000 })
    expect(result?.projection).toMatchObject({ totalPaymentsCents: 105_000 })
  })

  it('preserves the baseline and chunk 3 behavior exactly when monthly extra is zero', () => {
    expect(projectRecurringPayments([loan, other], 0)).toEqual(projectPortfolio([loan, other]))
    const extra = { loanId: loan.id, date: loan.balanceDate, amountCents: 100_000 }
    expect(projectRecurringPayments([loan, other], 0, extra)).toEqual(projectPortfolio([loan, other], extra))
  })

  it('keeps the original monthly day through short months', () => {
    const result = projectRecurringPayments([{ ...loan, principalCents: 1_000_000, nextPaymentDate: '2025-01-31' }], 1_000)
    expect(result?.loans[0]?.projection.schedule.filter(({ kind }) => kind === 'monthly-extra').slice(0, 3).map(({ date }) => date)).toEqual([
      '2025-01-31', '2025-02-28', '2025-03-31',
    ])
  })

  it('caps the last payment at the amount owed and spends no unused final budget', () => {
    const result = projectRecurringPayments([{ ...loan, principalCents: 12_345 }], 100_000)
    expect(result?.projection).toMatchObject({ status: 'paid-off', totalPaymentsCents: 12_345 })
    expect(result?.loans[0]?.projection.schedule.map(({ paymentCents }) => paymentCents)).toEqual([10_000, 2_345])
    expect(result?.projection.schedule.at(-1)?.balanceCents).toBe(0)
  })

  it('applies a same-day lump sum first, then minimums, then monthly extra', () => {
    const result = projectRecurringPayments([loan], 1_000, { loanId: loan.id, date: loan.nextPaymentDate, amountCents: 20_000 })
    expect(result?.loans[0]?.projection.schedule.slice(0, 3).map(({ kind, paymentCents }) => [kind, paymentCents])).toEqual([
      ['extra', 20_000], ['scheduled', 10_000], ['monthly-extra', 1_000],
    ])
  })

  it('supports full payoff today and only-interest balances without phantom future payments', () => {
    const result = projectRecurringPayments([{ ...loan, principalCents: 0, accruedInterestCents: 25_000 }], 1_000, {
      loanId: loan.id, date: loan.balanceDate, amountCents: 25_000,
    })
    expect(result?.projection).toMatchObject({ payoffDate: loan.balanceDate, totalPaymentsCents: 25_000, remainingInterestCents: 25_000 })
    expect(result?.projection.schedule).toHaveLength(1)
  })

  it('reconciles every cent across different due dates, interest, rollover and a lump sum', () => {
    const records = [
      { ...loan, principalCents: 1_800_000, accruedInterestCents: 7_500, annualRatePercent: 5.5, monthlyPaymentCents: 20_000, nextPaymentDate: '2025-01-31' },
      { ...other, annualRatePercent: 6.75 },
      { ...other, id: 'loan-c', principalCents: 250_000, annualRatePercent: 3.25, nextPaymentDate: '2025-02-10' },
    ]
    const result = projectRecurringPayments(records, 15_000, { loanId: other.id, date: '2025-01-16', amountCents: 20_000 })
    if (!result || result.projection.status !== 'paid-off') throw new Error('Expected payoff')
    const { projection } = result
    expect(projection.totalPaymentsCents).toBe(result.principalCents + projection.remainingInterestCents)
    expect(projection.schedule.reduce((sum, payment) => sum + payment.paymentCents, 0)).toBe(projection.totalPaymentsCents)
    expect(projection.schedule.reduce((sum, payment) => sum + payment.principalPaidCents, 0)).toBe(result.principalCents)
    expect(projection.schedule.reduce((sum, payment) => sum + payment.interestPaidCents, 0)).toBe(projection.remainingInterestCents)
    expect(projection.schedule.reduce((sum, payment) => sum + payment.newInterestCents, 0)).toBe(projection.futureInterestCents)
    expect(projection.schedule.every(({ balanceCents }) => balanceCents >= 0)).toBe(true)
  })

  it('does not claim a lifetime total when even the increased budget cannot pay off', () => {
    const result = projectRecurringPayments([{ ...loan, annualRatePercent: 100, monthlyPaymentCents: 1 }], 1)
    expect(result?.projection.status).toBe('projection-limit')
    expect(result?.projection).not.toHaveProperty('payoffDate')
    expect(result?.projection).not.toHaveProperty('remainingInterestCents')
  })

  it('uses stable loan IDs to break equal-rate ties without mutating or depending on array order', () => {
    const inputs = [Object.freeze({ ...loan }), Object.freeze({ ...other })]
    const before = structuredClone(inputs)
    expect(projectRecurringPayments(inputs, 1_000)?.projection).toEqual(projectRecurringPayments([...inputs].reverse(), 1_000)?.projection)
    expect(inputs).toEqual(before)
  })

  it.each([-1, 0.1, Number.NaN, Number.POSITIVE_INFINITY, 1_000_000_001])('rejects invalid extra monthly cents: %s', (amount) => {
    expect(() => projectRecurringPayments([loan], amount)).toThrow()
  })

  it('validates record identity, shared dates, loan values and one-time targets', () => {
    expect(projectRecurringPayments([], 100)).toBeNull()
    expect(() => projectRecurringPayments([loan, { ...other, id: loan.id }], 100)).toThrow('unique ID')
    expect(() => projectRecurringPayments([loan, { ...other, balanceDate: '2025-01-02' }], 100)).toThrow('same balance date')
    expect(() => projectRecurringPayments([{ ...loan, annualRatePercent: -1 }], 100)).toThrow()
    expect(() => projectRecurringPayments([loan], 100, { loanId: 'missing', date: loan.balanceDate, amountCents: 100 })).toThrow('existing loan')
    expect(() => projectRecurringPayments([loan], 100, { loanId: loan.id, date: loan.balanceDate, amountCents: -1 })).toThrow()
  })
})

describe('four-scenario comparison', () => {
  const request = { loanId: loan.id, oneTimeCents: 20_000, extraMonthlyCents: 10_000, date: loan.balanceDate }

  it('compares baseline, one-time only, monthly only, and both using a common starting point', () => {
    const result = comparePaymentScenarios([loan], request)
    expect(result.scenarios.map(({ id }) => id)).toEqual(['minimum', 'one-time', 'monthly', 'combined'])
    expect(result.scenarios.map(({ portfolio }) => portfolio.projection.status === 'paid-off' ? portfolio.projection.payoffDate : null)).toEqual([
      '2025-11-01', '2025-09-01', '2025-06-01', '2025-05-01',
    ])
    expect(result.scenarios.every(({ portfolio }) => portfolio.projection.status === 'paid-off' && portfolio.projection.totalPaymentsCents === 100_000)).toBe(true)
    expect(result.monthlyBudgetCents).toBe(20_000)
    expect(result.recurringStartDate).toBe('2025-02-01')
    expect(result.scenarios[3]?.savings?.interestCents).toBe(0)
    expect(result.scenarios[3]?.savings?.days).toBeGreaterThan(0)
  })

  it('treats all-zero inputs as the unchanged minimum baseline, not rollover-only', () => {
    const result = comparePaymentScenarios([loan, other], { ...request, oneTimeCents: 0, extraMonthlyCents: 0 })
    for (const scenario of result.scenarios) {
      expect(scenario.portfolio).toEqual(result.oneTime.baseline)
      expect(scenario.savings).toEqual({ interestCents: 0, days: 0 })
    }
  })

  it('does not use the one-time target to choose where the monthly budget goes', () => {
    const records = [loan, { ...other, annualRatePercent: 12 }]
    const first = comparePaymentScenarios(records, { ...request, oneTimeCents: 0 })
    const second = comparePaymentScenarios(records, { ...request, oneTimeCents: 0, loanId: other.id })
    expect(first.scenarios[2]?.portfolio.projection).toEqual(second.scenarios[2]?.portfolio.projection)
    expect(first.scenarios[3]?.portfolio.projection).toEqual(first.scenarios[2]?.portfolio.projection)
  })

  it('withholds savings against an unpaid baseline even if recurring extra enables payoff', () => {
    const result = comparePaymentScenarios([{ ...loan, annualRatePercent: 12, monthlyPaymentCents: 100 }], {
      ...request, oneTimeCents: 0, extraMonthlyCents: 10_000,
    })
    expect(result.scenarios[0]?.portfolio.projection.status).toBe('insufficient-payment')
    expect(result.scenarios[2]?.portfolio.projection.status).toBe('paid-off')
    expect(result.scenarios.every(({ savings }) => savings === null)).toBe(true)
  })

  it('never assumes historical payments or applies today’s payment to future snapshots', () => {
    expect(() => comparePaymentScenarios([loan], { ...request, date: '2025-02-02' })).toThrow('in the past')
    expect(() => comparePaymentScenarios([loan], { ...request, date: '2024-12-31' })).toThrow('in the future')
  })
})
