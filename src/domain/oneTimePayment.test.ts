import { describe, expect, it } from 'vitest'
import { projectLoan } from './loan'
import { compareOneTimePayment, oneTimePaymentAvailability } from './oneTimePayment'
import { projectPortfolio, type LoanRecord } from './portfolio'

const loan: LoanRecord = {
  id: 'loan-a',
  fromExample: false,
  name: 'Direct Loan A',
  type: 'unsubsidized',
  principalCents: 100_000,
  accruedInterestCents: 2_500,
  annualRatePercent: 12,
  monthlyPaymentCents: 30_000,
  balanceDate: '2025-01-01',
  nextPaymentDate: '2025-02-01',
}

const otherLoan: LoanRecord = {
  ...loan,
  id: 'loan-b',
  name: 'Direct Loan B',
  principalCents: 50_000,
  accruedInterestCents: 0,
  annualRatePercent: 3.5,
  monthlyPaymentCents: 25_000,
  nextPaymentDate: '2025-02-15',
}

describe('one-time payment comparison', () => {
  it('applies today’s payment to existing interest before principal', () => {
    const result = compareOneTimePayment([loan], { loanId: loan.id, date: loan.balanceDate, amountCents: 30_000 })
    expect(result.appliedCents).toBe(30_000)
    expect(result.interestPaidCents).toBe(2_500)
    expect(result.principalPaidCents).toBe(27_500)
    expect(result.balanceAfterExtraCents).toBe(72_500)
    expect(result.unusedCents).toBe(0)
    expect(result.targetScenario.projection.schedule[0]).toMatchObject({
      kind: 'extra', date: loan.balanceDate, newInterestCents: 0, paymentCents: 30_000,
    })
  })

  it('accrues interest through today without charging interest on unpaid interest', () => {
    const result = compareOneTimePayment([loan], { loanId: loan.id, date: '2025-01-16', amountCents: 20_000 })
    expect(result.interestPaidCents).toBe(2_993)
    expect(result.principalPaidCents).toBe(17_007)
    expect(result.balanceAfterExtraCents).toBe(82_993)
    expect(result.targetScenario.projection.schedule[1]).toMatchObject({
      kind: 'scheduled', date: '2025-02-01', paymentCents: 30_000, newInterestCents: 437,
    })
  })

  it('keeps monthly minimums and the original due-date anchor unchanged', () => {
    const result = compareOneTimePayment([loan], { loanId: loan.id, date: '2025-01-16', amountCents: 10_000 })
    const monthly = result.targetScenario.projection.schedule.filter(({ kind }) => kind === 'scheduled')
    expect(monthly.slice(0, 2).map(({ date, paymentCents }) => [date, paymentCents])).toEqual([
      ['2025-02-01', 30_000], ['2025-03-01', 30_000],
    ])
    const monthEnd = projectLoan({ ...loan, nextPaymentDate: '2025-01-31' }, { date: '2025-01-16', amountCents: 10_000 })
    expect(monthEnd.schedule.filter(({ kind }) => kind === 'scheduled').slice(0, 3).map(({ date }) => date)).toEqual([
      '2025-01-31', '2025-02-28', '2025-03-31',
    ])
  })

  it('applies the extra before the scheduled minimum on the same day', () => {
    const result = compareOneTimePayment([loan], { loanId: loan.id, date: loan.nextPaymentDate, amountCents: 10_000 })
    expect(result.targetScenario.projection.schedule.slice(0, 2)).toMatchObject([
      { kind: 'extra', date: '2025-02-01', paymentCents: 10_000, newInterestCents: 1_019 },
      { kind: 'scheduled', date: '2025-02-01', paymentCents: 30_000, newInterestCents: 0 },
    ])
  })

  it('caps an oversized payment at today’s payoff balance, with no transfer to other loans', () => {
    const result = compareOneTimePayment([loan, otherLoan], { loanId: loan.id, date: '2025-01-16', amountCents: 200_000 })
    expect(result.appliedCents).toBe(102_993)
    expect(result.unusedCents).toBe(97_007)
    expect(result.balanceAfterExtraCents).toBe(0)
    expect(result.targetScenario.projection).toMatchObject({
      status: 'paid-off', payoffDate: '2025-01-16', totalPaymentsCents: 102_993, remainingInterestCents: 2_993,
    })
    expect(result.targetScenario.projection.schedule).toHaveLength(1)
    expect(result.scenario.loans[1]?.projection).toEqual(projectLoan(otherLoan))
  })

  it('includes the applied lump sum in total payments rather than calling it a saving', () => {
    const zeroRate = { ...loan, annualRatePercent: 0 }
    const result = compareOneTimePayment([zeroRate], { loanId: loan.id, date: loan.balanceDate, amountCents: 30_000 })
    expect(result.scenario.projection).toMatchObject({ status: 'paid-off', totalPaymentsCents: 102_500, remainingInterestCents: 2_500 })
    expect(result.savings?.interestCents).toBe(0)
    expect(result.scenario.projection.schedule.reduce((sum, row) => sum + row.paymentCents, 0)).toBe(102_500)
  })

  it('treats zero as an unchanged scenario without adding a payment or rounding event', () => {
    const result = compareOneTimePayment([loan, otherLoan], { loanId: loan.id, date: '2025-01-16', amountCents: 0 })
    expect(result.scenario).toEqual(result.baseline)
    expect(result.savings).toEqual({ interestCents: 0, days: 0 })
    expect(result.appliedCents).toBe(0)
    expect(result.balanceAfterExtraCents).toBe(102_993)
    expect(result.targetScenario.projection.schedule.some(({ kind }) => kind === 'extra')).toBe(false)
  })

  it('can cover only part of accrued interest without falsely reducing principal', () => {
    const result = compareOneTimePayment([loan], { loanId: loan.id, date: loan.balanceDate, amountCents: 1_000 })
    expect(result.interestPaidCents).toBe(1_000)
    expect(result.principalPaidCents).toBe(0)
    expect(result.targetScenario.projection.schedule[0]?.principalCents).toBe(100_000)
    expect(result.targetScenario.projection.schedule[0]?.accruedInterestCents).toBe(1_500)
  })

  it('leaves every non-targeted loan’s independent schedule unchanged', () => {
    const result = compareOneTimePayment([loan, otherLoan], { loanId: loan.id, date: '2025-01-16', amountCents: 25_000 })
    expect(result.scenario.loans[1]?.projection).toEqual(result.baseline.loans[1]?.projection)
    expect(result.scenario.projection.schedule[0]).toMatchObject({ kind: 'extra', date: '2025-01-16' })
  })

  it('distinguishes a targeted loan’s earlier payoff from an unchanged overall date', () => {
    const slowerLoan = { ...otherLoan, principalCents: 500_000, monthlyPaymentCents: 10_000 }
    const result = compareOneTimePayment([loan, slowerLoan], { loanId: loan.id, date: loan.balanceDate, amountCents: 100_000 })
    expect(result.savings?.days).toBe(0)
    expect(result.savings?.interestCents).toBeGreaterThan(0)
    if (result.targetBaseline.projection.status !== 'paid-off' || result.targetScenario.projection.status !== 'paid-off') {
      throw new Error('Expected target payoff')
    }
    expect(result.targetScenario.projection.payoffDate < result.targetBaseline.projection.payoffDate).toBe(true)
  })

  it('resolves an insufficient-payment loan without inventing savings for an incomplete baseline', () => {
    const result = compareOneTimePayment([{ ...loan, monthlyPaymentCents: 500 }], {
      loanId: loan.id, date: loan.balanceDate, amountCents: 90_000,
    })
    expect(result.baseline.projection.status).toBe('insufficient-payment')
    expect(result.scenario.projection.status).toBe('paid-off')
    expect(result.savings).toBeNull()
  })

  it('withholds overall savings while any other loan still fails to pay off', () => {
    const result = compareOneTimePayment([loan, { ...otherLoan, monthlyPaymentCents: 1 }], {
      loanId: loan.id, date: loan.balanceDate, amountCents: 200_000,
    })
    expect(result.scenario.projection.status).not.toBe('paid-off')
    expect(result.targetScenario.projection.status).toBe('paid-off')
    expect(result.savings).toBeNull()
    expect(result.scenario.projection).not.toHaveProperty('remainingInterestCents')
  })

  it('preserves a negative cent-level difference caused by per-payment rounding', () => {
    const result = compareOneTimePayment([loan], { loanId: loan.id, date: '2025-01-04', amountCents: 1 })
    expect(result.savings).toEqual({ interestCents: -1, days: 0 })
  })

  it('groups an extra payment and scheduled payments on the same date', () => {
    const result = compareOneTimePayment([loan, { ...otherLoan, nextPaymentDate: loan.nextPaymentDate }], {
      loanId: loan.id, date: loan.nextPaymentDate, amountCents: 10_000,
    })
    expect(result.scenario.projection.schedule[0]).toMatchObject({
      kind: 'combined', date: loan.nextPaymentDate, paymentCents: 65_000,
    })
  })

  it('reconciles portfolio cash flows, remaining interest, and all principal to the cent', () => {
    const result = compareOneTimePayment([loan, otherLoan], { loanId: loan.id, date: '2025-01-16', amountCents: 20_000 })
    const { projection } = result.scenario
    if (projection.status !== 'paid-off') throw new Error('Expected payoff')
    expect(projection.totalPaymentsCents).toBe(result.scenario.principalCents + projection.remainingInterestCents)
    expect(projection.schedule.reduce((sum, row) => sum + row.paymentCents, 0)).toBe(projection.totalPaymentsCents)
    expect(projection.schedule.reduce((sum, row) => sum + row.newInterestCents, 0)).toBe(projection.futureInterestCents)
    expect(projection.schedule.reduce((sum, row) => sum + row.principalPaidCents, 0)).toBe(result.scenario.principalCents)
    expect(projection.schedule.reduce((sum, row) => sum + row.interestPaidCents, 0)).toBe(projection.remainingInterestCents)
    expect(projection.schedule.at(-1)?.balanceCents).toBe(0)
  })

  it('supports an interest-only balance and a single-cent full payoff', () => {
    const result = compareOneTimePayment([{ ...loan, principalCents: 0 }], {
      loanId: loan.id, date: loan.balanceDate, amountCents: 2_500,
    })
    expect(result.principalPaidCents).toBe(0)
    expect(result.targetScenario.projection).toMatchObject({ payoffDate: loan.balanceDate, remainingInterestCents: 2_500 })
    const tinyLoan = { ...loan, principalCents: 1, accruedInterestCents: 0 }
    expect(projectLoan(tinyLoan, { date: loan.balanceDate, amountCents: 1 }).schedule).toHaveLength(1)
  })

  it('does not mutate the entered balances or baseline when comparing repeatedly', () => {
    const inputs = [Object.freeze({ ...loan }), Object.freeze({ ...otherLoan })]
    const before = structuredClone(inputs)
    const baseline = projectPortfolio(inputs)
    compareOneTimePayment(inputs, { loanId: loan.id, date: '2025-01-16', amountCents: 20_000 })
    const another = compareOneTimePayment(inputs, { loanId: otherLoan.id, date: '2025-01-16', amountCents: 10_000 })
    expect(inputs).toEqual(before)
    expect(another.baseline).toEqual(baseline)
  })

  it.each([-1, 0.1, Number.NaN, Number.POSITIVE_INFINITY, 1_000_000_001])('rejects an invalid payment amount: %s', (amountCents) => {
    expect(() => compareOneTimePayment([loan], { loanId: loan.id, date: loan.balanceDate, amountCents })).toThrow()
  })

  it('rejects a missing target, dates outside the pre-payment window, and invalid dates', () => {
    expect(() => compareOneTimePayment([loan], { loanId: 'missing', date: loan.balanceDate, amountCents: 100 })).toThrow('existing loan')
    expect(() => projectLoan(loan, { date: '2024-12-31', amountCents: 100 })).toThrow('between')
    expect(() => projectLoan(loan, { date: '2025-02-02', amountCents: 100 })).toThrow('between')
    expect(() => projectLoan(loan, { date: '2025-02-30', amountCents: 100 })).toThrow()
  })
})

describe('payment today availability', () => {
  it('accepts an older snapshot when no scheduled payment has been missed', () => {
    expect(oneTimePaymentAvailability([loan, otherLoan], '2025-01-16')).toBeNull()
    expect(oneTimePaymentAvailability([loan], loan.nextPaymentDate)).toBeNull()
  })

  it('does not assume overdue payments have happened, including on a non-targeted loan', () => {
    expect(oneTimePaymentAvailability([loan], '2025-02-02')).toContain('in the past')
    expect(() => compareOneTimePayment([loan, otherLoan], {
      loanId: otherLoan.id, date: '2025-02-02', amountCents: 100,
    })).toThrow('won’t assume earlier payments happened')
  })

  it('rejects future balances, invalid calendar dates, and empty portfolios', () => {
    expect(oneTimePaymentAvailability([loan], '2024-12-31')).toContain('in the future')
    expect(oneTimePaymentAvailability([loan], '2025-02-29')).toContain('valid payment date')
    expect(oneTimePaymentAvailability([], '2025-01-01')).toContain('Add a loan')
  })
})
